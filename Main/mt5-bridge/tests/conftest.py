from __future__ import annotations

import atexit
import os
import shutil
import tempfile
from pathlib import Path


_TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="fyodor-bridge-tests-"))
os.environ["FYODOR_RESEARCH_DB"] = str(_TEST_DATA_DIR / "research.sqlite3")


@atexit.register
def _remove_test_data() -> None:
  shutil.rmtree(_TEST_DATA_DIR, ignore_errors=True)
