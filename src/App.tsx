import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
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
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const BranchesPage = lazy(() => import("./pages/BranchesPage"));
const TransfersPage = lazy(() => import("./pages/TransfersPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const LabelsPage = lazy(() => import("./pages/LabelsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const RepairsPage = lazy(() => import("./pages/RepairsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const HRPage = lazy(() => import("./pages/HRPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const StocktakePage = lazy(() => import("./pages/StocktakePage"));
const OnlineStorePage = lazy(() => import("./pages/OnlineStorePage"));
const OnlineOrdersPage = lazy(() => import("./pages/OnlineOrdersPage"));
const PublicStorePage = lazy(() => import("./pages/PublicStorePage"));
const DailyClosingsPage = lazy(() => import("./pages/DailyClosingsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage"));
const WholesalePage = lazy(() => import("./pages/WholesalePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const LockedPage = lazy(() => import("./pages/LockedPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
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
      <Route path="/inventory" element={<ProtectedRoute><CashierRedirect><InventoryPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/branches" element={<ProtectedRoute><CashierRedirect><BranchesPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><FeatureRoute feature="transfers"><CashierRedirect><TransfersPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><FeatureRoute feature="suppliers"><CashierRedirect><SuppliersPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      {/* Purchases lived here as a second door onto the same page */}
      <Route path="/purchases" element={<Navigate to="/suppliers?tab=orders" replace />} />
      <Route path="/labels" element={<ProtectedRoute><CashierRedirect><LabelsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><CashierRedirect><NotificationsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/marketing" element={<ProtectedRoute><FeatureRoute feature="marketing"><CashierRedirect><MarketingPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/repairs" element={<ProtectedRoute><FeatureRoute feature="repairs"><RepairsPage /></FeatureRoute></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><FeatureRoute feature="reports"><CashierRedirect><ReportsPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/stocktake" element={<ProtectedRoute><FeatureRoute feature="stocktake"><CashierRedirect><StocktakePage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><RoleRoute allow={["owner", "admin"]}><CashierRedirect><UsersPage /></CashierRedirect></RoleRoute></ProtectedRoute>} />
      <Route path="/hr" element={<ProtectedRoute><RoleRoute allow={["owner", "admin"]}><CashierRedirect><HRPage /></CashierRedirect></RoleRoute></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><PermissionRoute require="employees.view"><CashierRedirect><EmployeesPage /></CashierRedirect></PermissionRoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><CashierRedirect><SettingsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><RoleRoute allow={["owner", "admin"]}><CashierRedirect><SubscriptionPage /></CashierRedirect></RoleRoute></ProtectedRoute>} />
      <Route path="/online-store" element={<ProtectedRoute><FeatureRoute feature="onlineStore"><CashierRedirect><OnlineStorePage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/online-orders" element={<ProtectedRoute><FeatureRoute feature="onlineStore"><CashierRedirect><OnlineOrdersPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/daily-closings" element={<ProtectedRoute><DailyClosingsPage /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><FeatureRoute feature="customers"><CashierRedirect><CustomersPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><FeatureRoute feature="customers"><CashierRedirect><CustomerDetailPage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/wholesale" element={<ProtectedRoute><FeatureRoute feature="wholesale"><CashierRedirect><WholesalePage /></CashierRedirect></FeatureRoute></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
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
