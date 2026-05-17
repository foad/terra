/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./styles/global.css";
import "./i18n";
import { App } from "./app.tsx";

const DashboardPage = lazy(() => import("./pages/dashboard.tsx"));
const AdminCrisesPage = lazy(() => import("./pages/admin-crises.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/dashboard"
          element={
            <Suspense>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/crises"
          element={
            <Suspense>
              <AdminCrisesPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
