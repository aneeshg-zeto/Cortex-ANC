export class ConnectorAuthError extends Error {
  constructor(message = 'Connector authentication failed') {
    super(message);
    this.name = 'ConnectorAuthError';
  }
}

export class ConnectorRateLimitError extends Error {
  retryAfter: number;

  constructor(message = 'Connector rate limit exceeded', retryAfter = 60) {
    super(message);
    this.name = 'ConnectorRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export async function connectorFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, init);

  if (response.status === 401) {
    throw new ConnectorAuthError();
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? '60');
    throw new ConnectorRateLimitError(undefined, Number.isFinite(retryAfter) ? retryAfter : 60);
  }

  if (!response.ok) {
    throw new Error(`Connector request failed: ${response.status} ${response.statusText}`);
  }

  return response;
}
