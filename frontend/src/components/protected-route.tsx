import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const auth = useAuth();

  if (auth.isLoading) return null;
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
