const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api/v1';

export type Envelope<T> = {
  requestId: string;
  code: string;
  message: string;
  data: T;
  retryable: boolean;
  retryAfterMs?: number;
  meta?: { cursor?: string; hasMore?: boolean; total?: number };
};

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Envelope<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new ApiClientError(
      payload?.code ?? 'INTERNAL',
      payload?.message ?? '服务暂不可用，请稍后重试',
      response.status,
      payload?.retryable ?? true,
    );
  }
  return payload;
}

export const apiBase = BASE;