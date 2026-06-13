import { useAuth } from "react-oidc-context";
import { useCallback } from "react";
import { api } from "../utils/api";

/**
 * Wrap the bare `api()` helper with the current OIDC access token so analyst /
 * admin call sites don't have to thread it manually. Public/community endpoints
 * continue to use `api()` directly without a token.
 */
export const useApi = () => {
  const auth = useAuth();
  const token = auth.user?.access_token ?? null;

  return useCallback(
    (path: string, options?: RequestInit & { timeout?: number }) =>
      api(path, { ...options, token }),
    [token],
  );
};
