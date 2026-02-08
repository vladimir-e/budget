import type { ApiError } from './types.ts';

/** Error thrown when an API request fails */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error);
    this.name = 'ApiRequestError';
  }
}

/**
 * Fetch wrapper with JSON handling and error extraction.
 * All API calls go through this function.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // 204 No Content — return void-compatible empty object
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(res.status, body as ApiError);
  }

  return body as T;
}

/** GET request */
export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** POST request with JSON body */
export function post<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PUT request with JSON body */
export function put<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** DELETE request */
export function del<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
