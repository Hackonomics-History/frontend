import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "./auth/useAuth";

import MainLayout from "./components/layouts/MainLayout";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage"
import MyPage from "./pages/MyPage";
import HomePage from "./pages/HomePage";
import CalendarPage from "./pages/CalendarPage";
import NewsPage from "./pages/NewsPage";

function ProtectedRoute() {
  const { accessToken, loading } = useAuth();

  if (loading) return null;
  if (!accessToken) return <Navigate to="/login" replace />;

  return <Outlet />;
}

function PublicRoute() {
  const { accessToken } = useAuth();
  if (accessToken) return <Navigate to="/me" replace />;
  return <Outlet />;
}
// Routers
export default function AppRouter() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route element={<PublicRoute />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        </Route>

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/me" element={<MyPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/news/" element={<NewsPage />} />

          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}