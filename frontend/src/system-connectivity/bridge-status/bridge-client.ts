const apiRoot = '/api/v1'

export class BridgeRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    message: string,
    status: number,
    code: string,
  ) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function bridgeResponse(path: string, signal?: AbortSignal, accept = 'application/json'): Promise<Response> {
  const response = await fetch(`${apiRoot}${path}`, {
    method: 'GET',
    headers: { Accept: accept },
    signal,
  })
  if (!response.ok) {
    let code = 'bridge-request-failed'
    let message = `Bridge returned HTTP ${response.status}`
    try {
      const body = await response.json() as { detail?: { code?: string; message?: string } }
      code = body.detail?.code ?? code
      message = body.detail?.message ?? message
    } catch {
      // Preserve the HTTP fallback when the process failed before producing JSON.
    }
    throw new BridgeRequestError(message, response.status, code)
  }
  return response
}

export async function bridgeRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await bridgeResponse(path, signal)).json() as Promise<T>
}
