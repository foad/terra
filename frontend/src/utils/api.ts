const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export const api = async (path: string, options?: RequestInit) => {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
};
