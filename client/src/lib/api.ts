import axios, { type AxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Free Render instances sleep after ~15 min idle and need ~20 s to boot.
// The first request through the Vercel proxy gets a 502 before the API is up,
// so wait a few seconds and retry once instead of surfacing the error.
const WAKE_UP_STATUS = new Set([502, 503, 504]);
const WAKE_UP_DELAYS_MS = [7000, 11000];

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (AxiosRequestConfig & { __wakeRetries?: number }) | undefined;
  const retries = config?.__wakeRetries ?? 0;
  if (!config || !WAKE_UP_STATUS.has(error.response?.status) || retries >= WAKE_UP_DELAYS_MS.length) {
    throw error;
  }
  config.__wakeRetries = retries + 1;
  await new Promise((resolve) => setTimeout(resolve, WAKE_UP_DELAYS_MS[retries]));
  return api.request(config);
});

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the SplitMate server. Is the API running?';
    }
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
