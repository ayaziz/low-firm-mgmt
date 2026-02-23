/* ──────────────────────────────────────────
   HTTP client for LOMA backend API
   ────────────────────────────────────────── */

// Use relative URLs to go through nginx proxy (same origin)
// On server side (SSR), use internal Docker hostname
const API_BASE = typeof window === 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000')
  : ''; // Empty = relative URLs for browser (goes through nginx)
const API_PREFIX = '/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('loma_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not for FormData/streams)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE}${API_PREFIX}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  // Handle blob responses (PDF, CSV)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('text/csv')) {
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, error.message || res.statusText);
    }
    return res.blob() as unknown as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.message || res.statusText,
      data?.error,
    );
  }

  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public error?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── HTTP Methods ──

export function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  let query = '';
  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
    if (entries.length) {
      query = '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    }
  }
  return request<T>(path + query);
}

export function post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: extraHeaders,
  });
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function del<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// ── Convenience: download blob ──
export async function downloadBlob(path: string, filename: string): Promise<void> {
  const blob = await get<Blob>(path);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
