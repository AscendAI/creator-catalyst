import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RefreshProvider } from "@/lib/refresh";
import { AdminRefreshProvider } from "@/lib/admin-refresh";
import { PayoutSyncProvider } from "@/lib/payout-sync";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import NotFound from "@/pages/not-found";
import { useEffect, useRef } from "react";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import VerifyEmailPage from "@/pages/auth/verify-email";
import CreatorDashboard from "@/pages/creator/dashboard";
import CreatorVideos from "@/pages/creator/videos";
import CreatorRules from "@/pages/creator/rules";
import CreatorConnect from "@/pages/creator/connect";
import AdminCreators from "@/pages/admin/creators";
import AdminCreatorDetail from "@/pages/admin/creator-detail";
import AdminPayouts from "@/pages/admin/payouts";
import AdminSync from "@/pages/admin/sync";
import AdminSettings from "@/pages/admin/settings";
import AdminSupport from "@/pages/admin/support";
import AdminCreatorHub from "@/pages/admin/creator-hub";
import CreatorContact from "@/pages/creator/contact";
import CreatorPayouts from "@/pages/creator/payouts";
import NotionPage from "@/pages/notion";
import VideoGuidesPage from "@/pages/video-guides";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/creator"} />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/creator"} />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return <Redirect to={user.role === "admin" ? "/admin" : "/creator"} />;
}

function RouteChangeHandler() {
  const [location] = useLocation();
  const prevLocation = useRef(location);

  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      queryClient.invalidateQueries();
    }
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
    <RouteChangeHandler />
    <Switch>
      <Route path="/">
        <HomeRedirect />
      </Route>

      <Route path="/login">
        <AuthRoute>
          <LoginPage />
        </AuthRoute>
      </Route>

      <Route path="/signup">
        <AuthRoute>
          <SignupPage />
        </AuthRoute>
      </Route>

      <Route path="/forgot-password">
        <AuthRoute>
          <ForgotPasswordPage />
        </AuthRoute>
      </Route>

      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>

      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>

      <Route path="/creator">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/dashboard">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/videos">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorVideos />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/rules">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorRules />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/connect">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorConnect />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/contact">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorContact />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/payouts">
        <ProtectedRoute allowedRoles={["creator"]}>
          <CreatorPayouts />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/notion">
        <ProtectedRoute allowedRoles={["creator"]}>
          <NotionPage />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/video-guides">
        <ProtectedRoute allowedRoles={["creator"]}>
          <VideoGuidesPage />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/creator-hub">
        <ProtectedRoute allowedRoles={["creator"]}>
          <AdminCreatorHub />
        </ProtectedRoute>
      </Route>

      <Route path="/creator/creators/:id">
        <ProtectedRoute allowedRoles={["creator"]}>
          <AdminCreatorDetail />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCreators />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/creator-hub">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCreatorHub />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/creators">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCreators />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/creators/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCreatorDetail />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/payouts">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayouts />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/sync">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSync />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSettings />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/support">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupport />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/notion">
        <ProtectedRoute allowedRoles={["admin"]}>
          <NotionPage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/video-guides">
        <ProtectedRoute allowedRoles={["admin"]}>
          <VideoGuidesPage />
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <RefreshProvider>
              <AdminRefreshProvider>
                <PayoutSyncProvider>
                  <Toaster />
                  <Router />
                </PayoutSyncProvider>
              </AdminRefreshProvider>
            </RefreshProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
