/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { AuthProvider } from "react-oidc-context";
import "./styles/global.css";
import "./i18n";
import { App } from "./app.tsx";
import { ProtectedRoute } from "./components/protected-route.tsx";

const DashboardPage = lazy(() => import("./pages/dashboard.tsx"));
const AdminCrisesPage = lazy(() => import("./pages/admin-crises.tsx"));
const LoginPage = lazy(() => import("./pages/login.tsx"));

const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: window.location.origin + "/login",
  post_logout_redirect_uri: window.location.origin + "/login",
  response_type: "code",
  scope: "email openid phone",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route
            path="/login"
            element={
              <Suspense>
                <LoginPage mode="signin" />
              </Suspense>
            }
          />
          <Route
            path="/logout"
            element={
              <Suspense>
                <LoginPage mode="signout" />
              </Suspense>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Suspense>
                  <DashboardPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/crises"
            element={
              <ProtectedRoute>
                <Suspense>
                  <AdminCrisesPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
