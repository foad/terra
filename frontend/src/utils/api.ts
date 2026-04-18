const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

const DEFAULT_TIMEOUT = 10000;

export const api = async (
  path: string,
  options?: RequestInit & { timeout?: number },
) => {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options ?? {};
  const url = `${API_BASE}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
};
