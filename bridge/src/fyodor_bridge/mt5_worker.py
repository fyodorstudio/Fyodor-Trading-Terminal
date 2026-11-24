from __future__ import annotations

import multiprocessing
import queue
import threading
from concurrent.futures import Future, TimeoutError as FutureTimeoutError
from dataclasses import asdict, dataclass, field
from time import monotonic
from typing import Any

from .mt5_adapter_process import run_mt5_adapter
from .mt5_process import MultipleTerminalProcessesError, find_terminal_process
from .runtime_activity import ActivityLedger, utc_milliseconds
from .settings import BridgeSettings


class Mt5UnavailableError(RuntimeError):
    pass


class Mt5AdapterFailure(Mt5UnavailableError):
    pass


class SupersededRequest(RuntimeError):
    pass


@dataclass
class Mt5Status:
    process_running: bool = False
    process_id: int | None = None
    terminal_path: str | None = None
    adapter_process_id: int | None = None
    connected: bool = False
    state: str = "starting"
    generation: int = 0
    last_attempt_at: int | None = None
    last_success_at: int | None = None
    last_error: str | None = None
    package_version: str | None = None
    account_login: int | None = None
    account_server: str | None = None


@dataclass(order=True)
class _QueuedCall:
    priority: int
    order: int
    category: str = field(compare=False)
    generation: int | None = field(compare=False)
    operation: str = field(compare=False)
    arguments: dict[str, object] = field(compare=False)
    future: Future[Any] = field(compare=False)


class Mt5Worker:
    def __init__(self, settings: BridgeSettings, activity: ActivityLedger) -> None:
        self._settings = settings
        self._activity = activity
        self._status = Mt5Status()
        self._status_lock = threading.RLock()
        self._queue: queue.PriorityQueue[_QueuedCall] = queue.PriorityQueue()
        self._latest_generation: dict[str, int] = {}
        self._generation_lock = threading.RLock()
        self._order = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_status_check = 0.0
        self._retry_not_before = 0.0
        self._request_sequence = 0
        self._mp_context = multiprocessing.get_context("spawn")
        self._adapter_process: Any | None = None
        self._adapter_commands: Any | None = None
        self._adapter_responses: Any | None = None
        self._adapter_terminal_pid: int | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._activity.append("Bridge", "MT5 supervisor started", "Native MT5 calls isolated in a child process", "success")
        self._thread = threading.Thread(target=self._run, name="fyodor-mt5-supervisor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self._settings.mt5_call_timeout_seconds + 2)
            if self._thread.is_alive():
                self._activity.append("MT5", "Supervisor shutdown timed out", severity="warning")
        self._stop_adapter()

    def snapshot(self) -> dict[str, object]:
        with self._status_lock:
            return asdict(self._status)

    def submit(
        self,
        category: str,
        operation: str,
        arguments: dict[str, object] | None = None,
        *,
        priority: int = 10,
        timeout: float | None = None,
        supersede: bool = True,
    ) -> Any:
        future: Future[Any] = Future()
        with self._generation_lock:
            generation = None
            if supersede:
                generation = self._latest_generation.get(category, 0) + 1
                self._latest_generation[category] = generation
            self._order += 1
            queued = _QueuedCall(
                priority,
                self._order,
                category,
                generation,
                operation,
                arguments or {},
                future,
            )
        self._queue.put(queued)
        wait_seconds = timeout or self._settings.mt5_call_timeout_seconds + 1
        try:
            return future.result(timeout=wait_seconds)
        except FutureTimeoutError as error:
            future.cancel()
            raise Mt5UnavailableError(f"MT5 adapter timed out after {wait_seconds:.1f}s") from error

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._refresh_connection_if_due()
            except Exception as error:
                self._stop_adapter()
                self._set_error(f"MT5 supervisor failed: {error}", "supervisor-error")
            try:
                queued = self._queue.get(timeout=0.2)
            except queue.Empty:
                continue

            if queued.future.cancelled():
                continue
            with self._generation_lock:
                latest = self._latest_generation.get(queued.category)
            if queued.generation is not None and latest != queued.generation:
                queued.future.set_exception(SupersededRequest("A newer request replaced this one"))
                continue

            try:
                self._ensure_connected()
                result = self._request_adapter(queued.operation, queued.arguments)
            except Exception as error:
                mapped_error = self._record_operation_error(error)
                if not queued.future.cancelled():
                    queued.future.set_exception(mapped_error)
            else:
                if not queued.future.cancelled():
                    queued.future.set_result(result)

        self._stop_adapter()

    def _refresh_connection_if_due(self) -> None:
        now = monotonic()
        if now < self._retry_not_before:
            return
        if now - self._last_status_check < self._settings.mt5_status_interval_seconds:
            return
        self._last_status_check = now
        self._refresh_connection()

    def _ensure_connected(self) -> None:
        self._refresh_connection_if_due()
        with self._status_lock:
            connected = self._status.connected
            last_error = self._status.last_error
        if not connected or not self._adapter_is_alive():
            raise Mt5UnavailableError(last_error or "MT5 is not connected")

    def _refresh_connection(self) -> None:
        try:
            terminal = find_terminal_process(self._settings.mt5_terminal_path)
        except MultipleTerminalProcessesError as error:
            with self._status_lock:
                self._status.process_running = True
                self._status.process_id = None
                self._status.terminal_path = None
            self._set_error(str(error), "terminal-selection-required")
            self._stop_adapter()
            return
        except Exception as error:
            self._stop_adapter()
            self._set_error(f"Unable to inspect MT5 processes: {error}", "process-detection-failed")
            return

        if terminal is None:
            self._set_terminal_absent()
            return

        with self._status_lock:
            self._status.process_running = True
            self._status.process_id = terminal.pid
            self._status.terminal_path = terminal.executable

        if self._adapter_terminal_pid == terminal.pid and self._adapter_is_alive():
            return

        self._stop_adapter()
        try:
            self._start_adapter(terminal.pid, terminal.executable)
        except Exception as error:
            self._stop_adapter()
            self._set_error(f"Unable to start native MT5 adapter: {error}", "adapter-start-failed")

    def _start_adapter(self, terminal_pid: int, terminal_path: str) -> None:
        with self._status_lock:
            self._status.connected = False
            self._status.state = "connecting"
            self._status.last_attempt_at = utc_milliseconds()

        commands = self._mp_context.Queue()
        responses = self._mp_context.Queue()
        process = self._mp_context.Process(
            target=run_mt5_adapter,
            args=(commands, responses, terminal_path, int(self._settings.mt5_call_timeout_seconds * 1000)),
            name="fyodor-mt5-adapter",
            daemon=True,
        )
        process.start()
        self._adapter_process = process
        self._adapter_commands = commands
        self._adapter_responses = responses
        self._adapter_terminal_pid = terminal_pid
        with self._status_lock:
            self._status.adapter_process_id = process.pid

        try:
            ready = self._wait_for_response(self._settings.mt5_call_timeout_seconds)
        except Mt5UnavailableError as error:
            self._stop_adapter()
            self._set_error(str(error), "adapter-timeout")
            self._retry_not_before = monotonic() + 5
            return

        if ready.get("kind") != "ready" or not ready.get("ok"):
            message = str(ready.get("error") or "MT5 adapter failed to initialize")
            self._stop_adapter()
            self._set_error(message, "initialization-failed")
            self._retry_not_before = monotonic() + 5
            return

        with self._status_lock:
            self._status.connected = True
            self._status.state = "connected"
            self._status.generation += 1
            generation = self._status.generation
            self._status.last_success_at = utc_milliseconds()
            self._status.last_error = None
            self._status.package_version = ready.get("package_version")
            self._status.account_login = ready.get("account_login")
            self._status.account_server = ready.get("account_server")
        self._retry_not_before = 0.0
        self._activity.append(
            "MT5",
            "Terminal connected",
            f"PID {terminal_pid} · adapter {process.pid} · generation {generation}",
            "success",
        )

    def _request_adapter(self, operation: str, arguments: dict[str, object]) -> Any:
        if not self._adapter_commands:
            raise Mt5UnavailableError("MT5 adapter is not running")
        self._request_sequence += 1
        request_id = self._request_sequence
        self._adapter_commands.put(
            {
                "request_id": request_id,
                "operation": operation,
                "arguments": arguments,
            },
        )
        response = self._wait_for_response(self._settings.mt5_call_timeout_seconds)
        if response.get("kind") != "result" or int(response.get("request_id", -1)) != request_id:
            raise Mt5UnavailableError("MT5 adapter returned an invalid response")
        if not response.get("ok"):
            raise RuntimeError(str(response.get("error") or "MT5 operation failed"))
        with self._status_lock:
            self._status.last_success_at = utc_milliseconds()
            self._status.last_error = None
        return response.get("result")

    def _wait_for_response(self, timeout_seconds: float) -> dict[str, Any]:
        deadline = monotonic() + timeout_seconds
        while True:
            try:
                return self._adapter_responses.get_nowait()
            except queue.Empty:
                pass
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise Mt5AdapterFailure(f"Native MT5 adapter exceeded {timeout_seconds:.1f}s and was terminated")
            if not self._adapter_is_alive():
                raise Mt5AdapterFailure("Native MT5 adapter exited unexpectedly")
            try:
                return self._adapter_responses.get(timeout=min(0.2, remaining))
            except queue.Empty:
                continue

    def _adapter_is_alive(self) -> bool:
        return bool(self._adapter_process and self._adapter_process.is_alive())

    def _stop_adapter(self) -> None:
        process = self._adapter_process
        commands = self._adapter_commands
        responses = self._adapter_responses
        self._adapter_process = None
        self._adapter_commands = None
        self._adapter_responses = None
        self._adapter_terminal_pid = None
        with self._status_lock:
            self._status.adapter_process_id = None
            self._status.connected = False

        if process is not None:
            if process.is_alive() and commands is not None:
                try:
                    commands.put_nowait({"operation": "shutdown"})
                except Exception:
                    pass
                process.join(timeout=0.3)
            if process.is_alive():
                process.terminate()
                process.join(timeout=1)
            if process.is_alive():
                process.kill()
                process.join(timeout=1)
            try:
                process.close()
            except Exception:
                pass

        for channel in (commands, responses):
            if channel is None:
                continue
            try:
                channel.close()
                channel.cancel_join_thread()
            except Exception:
                pass

    def _set_terminal_absent(self) -> None:
        self._retry_not_before = 0.0
        with self._status_lock:
            changed = self._status.process_running or self._status.state != "waiting-for-terminal"
            self._status.process_running = False
            self._status.process_id = None
            self._status.terminal_path = None
            self._status.connected = False
            self._status.state = "waiting-for-terminal"
            self._status.last_error = "MT5 terminal process is not running"
            self._status.account_login = None
            self._status.account_server = None
        self._stop_adapter()
        if changed:
            self._activity.append("MT5", "Terminal not running", severity="warning")

    def _set_error(self, message: str, state: str) -> None:
        with self._status_lock:
            changed = self._status.last_error != message
            self._status.connected = False
            self._status.state = state
            self._status.last_error = message
        if changed:
            self._activity.append("MT5", "Connection unavailable", message, "error")

    def _record_operation_error(self, error: Exception) -> Exception:
        message = str(error)
        adapter_failure = isinstance(error, Mt5AdapterFailure)

        terminal_running = False
        try:
            terminal_running = find_terminal_process(self._settings.mt5_terminal_path) is not None
        except Exception:
            pass

        if not terminal_running:
            self._stop_adapter()
            with self._status_lock:
                self._status.connected = False
                self._status.state = "waiting-for-terminal"
                self._status.last_error = "MT5 terminal process is not running"
            self._activity.append("MT5", "Terminal disconnected", message, severity="warning")
            self._last_status_check = 0.0
            self._retry_not_before = monotonic() + 1
            return Mt5UnavailableError(message)

        if adapter_failure:
            self._stop_adapter()
            with self._status_lock:
                self._status.connected = False
                self._status.state = "adapter-recovery"
                self._status.last_error = message
            self._activity.append("MT5", "Native adapter timeout", message, severity="error")
            self._last_status_check = 0.0
            self._retry_not_before = monotonic() + 1
            return Mt5UnavailableError(message)

        return error
