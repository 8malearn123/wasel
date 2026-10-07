import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LegacyRedirect } from "@/components/common/LegacyRedirect";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { type FeatureKey } from "@/lib/planAccess";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { UserRole } from "@/types/database";
import { usePermissions, type PermissionKey } from "@/hooks/usePermissions";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { useSubscription } from "./hooks/useSubscription";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POSPage = lazy(() => import("./pages/POSPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ShippingPage = lazy(() => import("./pages/ShippingPage"));
const AIInsightsPage = lazy(() => import("./pages/AIInsightsPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const SalesPage = lazy(() => import("./pages/SalesPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const PublicStorePage = lazy(() => import("./pages/PublicStorePage"));
const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const LockedPage = lazy(() => import("./pages/LockedPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminCompaniesPage = lazy(() => import("./pages/admin/AdminCompaniesPage"));
const AdminBranchRequestsPage = lazy(() => import("./pages/admin/AdminBranchRequestsPage"));
const AdminPayoutsPage = lazy(() => import("./pages/admin/AdminPayoutsPage"));
const AdminPlansPage = lazy(() => import("./pages/admin/AdminPlansPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminTicketsPage = lazy(() => import("./pages/admin/AdminTicketsPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminAuthPage = lazy(() => import("./pages/admin/AdminAuthPage"));
const OAuthConsentPage = lazy(() => import("./pages/OAuthConsentPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isLocked } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLocked) {
    return <Navigate to="/locked" replace />;
  }

  return <>{children}</>;
}

function LockedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isLocked } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isLocked) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// A plan-gated page. Hiding the sidebar entry never stopped anyone typing the
// URL, so the route itself refuses too. This is a usability guard, not the
// security boundary — that is RLS, which scopes every row to the merchant.
function FeatureRoute({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { loading } = useAuth();
  const { allows, loading: plansLoading } = useFeatureAccess();

  if (loading || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!allows(feature)) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}

// Pages only certain roles may open, by the role on the merchant_users row.
function RoleRoute({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { merchantUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!merchantUser || !allow.includes(merchantUser.role as UserRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// A page gated on a permission. Like FeatureRoute this only saves the user a
// blank screen — the data behind it is gated by RLS calling has_permission()
// for the same key.
function PermissionRoute({ require, children }: { require: PermissionKey; children: React.ReactNode }) {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!can(require)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function CashierRedirect({ children }: { children: React.ReactNode }) {
  const { merchantUser } = useAuth();
  if (merchantUser?.role === 'cashier') {
    return <Navigate to="/pos" replace />;
  }
  return <>{children}</>;
}

// Root: public landing page for visitors, dashboard for signed-in users
function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ProtectedRoute>
      <CashierRedirect>
        <Dashboard />
      </CashierRedirect>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  useVersionCheck();
  return (
    <ErrorBoundary>
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
      <Route path="/locked" element={<LockedRoute><LockedPage /></LockedRoute>} />
      <Route path="/" element={<HomeRoute />} />
      <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />

      {/* ---- The nine sections ---- */}
      <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
      <Route path="/shipping" element={<ProtectedRoute><CashierRedirect><ShippingPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><FeatureRoute feature="reports"><CashierRedirect><ReportsPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
      <Route path="/ai-insights" element={<ProtectedRoute><CashierRedirect><AIInsightsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><RoleRoute allow={["owner", "admin"]}><CashierRedirect><SubscriptionPage /></CashierRedirect></RoleRoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* A customer's own page stays a route of its own, not a tab */}
      <Route path="/customers/:id" element={<ProtectedRoute><FeatureRoute feature="customers"><CashierRedirect><CustomerDetailPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />

      {/* ---- Paths from before the consolidation. None of them is removed. ---- */}
      <Route path="/inventory" element={<LegacyRedirect to="/products" tab="inventory" />} />
      <Route path="/stocktake" element={<LegacyRedirect to="/products" tab="stocktake" />} />
      <Route path="/transfers" element={<LegacyRedirect to="/products" tab="transfers" />} />
      <Route path="/suppliers" element={<LegacyRedirect to="/products" tab="suppliers" />} />
      <Route path="/purchases" element={<LegacyRedirect to="/products" tab="suppliers" sub="orders" />} />
      <Route path="/labels" element={<LegacyRedirect to="/products" tab="labels" />} />

      <Route path="/online-orders" element={<LegacyRedirect to="/sales" tab="orders" />} />
      <Route path="/repairs" element={<LegacyRedirect to="/sales" tab="repairs" />} />
      <Route path="/daily-closings" element={<LegacyRedirect to="/sales" tab="closings" />} />
      <Route path="/online-store" element={<LegacyRedirect to="/sales" tab="store" />} />
      <Route path="/store-seo" element={<LegacyRedirect to="/sales" tab="seo" />} />
      <Route path="/customers" element={<LegacyRedirect to="/sales" tab="customers" />} />
      <Route path="/marketing" element={<LegacyRedirect to="/sales" tab="marketing" />} />
      <Route path="/wholesale" element={<LegacyRedirect to="/sales" tab="wholesale" />} />

      <Route path="/employees" element={<LegacyRedirect to="/team" tab="employees" />} />
      <Route path="/attendance" element={<LegacyRedirect to="/team" tab="attendance" />} />
      <Route path="/devices" element={<LegacyRedirect to="/team" tab="devices" />} />
      <Route path="/hr" element={<LegacyRedirect to="/team" tab="payroll" />} />
      <Route path="/users" element={<LegacyRedirect to="/team" tab="users" />} />

      <Route path="/notifications" element={<LegacyRedirect to="/settings" tab="notifications" />} />
      <Route path="/business-policy" element={<LegacyRedirect to="/settings" tab="policy" />} />
      <Route path="/branches" element={<LegacyRedirect to="/settings" tab="branches" />} />
      <Route path="/support" element={<LegacyRedirect to="/settings" tab="support" />} />

      <Route path="/store/:slug/*" element={<PublicStorePage />} />
      {/* Admin Auth */}
      <Route path="/admin/login" element={<AdminAuthPage />} />
      {/* Independent Admin Dashboard */}
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/companies" element={<AdminCompaniesPage />} />
      <Route path="/admin/branch-requests" element={<AdminBranchRequestsPage />} />
      <Route path="/admin/payouts" element={<AdminPayoutsPage />} />
      <Route path="/admin/plans" element={<AdminPlansPage />} />
      <Route path="/admin/activity" element={<AdminActivityPage />} />
      <Route path="/admin/tickets" element={<AdminTicketsPage />} />
      <Route path="/admin/reports" element={<AdminReportsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
