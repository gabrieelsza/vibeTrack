import { MusicPreferences, PhotoAnalysis, UserProfile } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8550/api/v1';

const TOKEN_STORAGE_KEY = 'vibetrack_auth_token';

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryAfterSeconds?: number;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.status = params.status;
    this.code = params.code || 'API_ERROR';
    this.retryAfterSeconds = params.retryAfterSeconds;
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function parseRetryAfterHeader(headerVal: string | null): number | undefined {
  if (!headerVal) return undefined;
  const num = Number(headerVal.trim());
  if (Number.isFinite(num) && num > 0) {
    return Math.ceil(num);
  }
  return undefined;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiRequestError({
      message:
        'Não foi possível comunicar com o servidor. Verifique sua conexão de internet e tente novamente.',
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data?.code || data?.error?.code || `HTTP_${response.status}`;
    const retryAfterSeconds =
      typeof data?.retryAfterSeconds === 'number'
        ? data.retryAfterSeconds
        : typeof data?.error?.retryAfterSeconds === 'number'
        ? data.error.retryAfterSeconds
        : parseRetryAfterHeader(response.headers.get('Retry-After'));

    const isBusyOrRateLimit =
      response.status === 429 || response.status === 503 || code === 'BUSY';

    const errorMessage = isBusyOrRateLimit
      ? 'A banda está ocupada. Tente de novo em alguns segundos'
      : data?.error?.message || `Falha na requisição (status ${response.status}).`;

    throw new ApiRequestError({
      message: errorMessage,
      status: response.status,
      code,
      retryAfterSeconds,
    });
  }

  return data as T;
}

export const apiService = {
  async register(payload: { name: string; email: string; password: string }) {
    return request<{
      token: string;
      user: UserProfile;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: { email: string; password: string }) {
    return request<{
      token: string;
      user: UserProfile;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe() {
    return request<{ user: UserProfile }>('/auth/me');
  },

  async createAnalysis(
    payload: {
      imageBase64: string;
      imageThumbnail?: string;
      preferences?: MusicPreferences;
      bypassCache?: boolean;
    },
    options?: { signal?: AbortSignal; simulate429?: string }
  ) {
    const extraHeaders: Record<string, string> = {};
    if (options?.simulate429) {
      extraHeaders['x-simulate-429'] = options.simulate429;
    }

    return request<{ analysis: PhotoAnalysis; cached?: boolean }>('/analyses', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: options?.signal,
      headers: extraHeaders,
    });
  },

  async regenerateAnalysis(
    analysisId: string,
    options?: { signal?: AbortSignal; simulate429?: string }
  ) {
    const extraHeaders: Record<string, string> = {};
    if (options?.simulate429) {
      extraHeaders['x-simulate-429'] = options.simulate429;
    }

    return request<{ analysis: PhotoAnalysis }>(
      `/analyses/${analysisId}/regenerate`,
      {
        method: 'POST',
        signal: options?.signal,
        headers: extraHeaders,
      }
    );
  },

  async listAnalyses() {
    return request<{ analyses: PhotoAnalysis[] }>('/analyses');
  },

  async deleteAnalysis(analysisId: string) {
    return request<{ message: string; deletedId: string }>(`/analyses/${analysisId}`, {
      method: 'DELETE',
    });
  },
};
