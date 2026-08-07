import React, { Suspense, lazy } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "sonner";

// 🔥 LAZY LOAD EVERYTHING HEAVY
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ChatDashboard = lazy(() => import("./pages/ChatDashboard"));
const Landing = lazy(() => import("./pages/Landing")); // ✅ NEW
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

// 🔥 GLOBAL LOADER (keep lightweight)
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <h1
        className="text-2xl font-bold tracking-widest text-white"
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        ATHE
      </h1>
    </div>
  );
}

// 🔐 Protected Route (chat only)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return user ? children : <Navigate to="/auth" replace />;
}

// 🌐 Public Route
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return user ? <Navigate to="/chat" replace /> : children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 🔥 FAST LANDING PAGE */}
        <Route path="/" element={<Landing />} />

        {/* 📄 LEGAL (public, needed for AdSense review) */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* 🔐 AUTH */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />

        {/* 💬 CHAT (HEAVY - LOAD ONLY WHEN NEEDED) */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatDashboard />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />

        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            className: "bg-[#0f172a] border-white/10 text-white",
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
