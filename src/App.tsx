import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import { AuthProvider, useAuth } from "./hooks/useAuth";
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
      <Route path="/transfers" element={<ProtectedRoute><CashierRedirect><TransfersPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><CashierRedirect><SuppliersPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><CashierRedirect><SuppliersPage mode="purchases" /></CashierRedirect></ProtectedRoute>} />
      <Route path="/labels" element={<ProtectedRoute><CashierRedirect><LabelsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><CashierRedirect><NotificationsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/marketing" element={<ProtectedRoute><CashierRedirect><MarketingPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/repairs" element={<ProtectedRoute><RepairsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><CashierRedirect><ReportsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/stocktake" element={<ProtectedRoute><CashierRedirect><StocktakePage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><CashierRedirect><UsersPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/hr" element={<ProtectedRoute><CashierRedirect><HRPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><CashierRedirect><SettingsPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><CashierRedirect><SubscriptionPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/online-store" element={<ProtectedRoute><CashierRedirect><OnlineStorePage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/online-orders" element={<ProtectedRoute><CashierRedirect><OnlineOrdersPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/daily-closings" element={<ProtectedRoute><DailyClosingsPage /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><CashierRedirect><CustomersPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CashierRedirect><CustomerDetailPage /></CashierRedirect></ProtectedRoute>} />
      <Route path="/wholesale" element={<ProtectedRoute><CashierRedirect><WholesalePage /></CashierRedirect></ProtectedRoute>} />
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
