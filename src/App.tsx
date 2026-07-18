import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { useSubscription } from "./hooks/useSubscription";
import Dashboard from "./pages/Dashboard";
import POSPage from "./pages/POSPage";
import InventoryPage from "./pages/InventoryPage";
import BranchesPage from "./pages/BranchesPage";
import TransfersPage from "./pages/TransfersPage";
import SuppliersPage from "./pages/SuppliersPage";
import LabelsPage from "./pages/LabelsPage";
import NotificationsPage from "./pages/NotificationsPage";
import MarketingPage from "./pages/MarketingPage";
import RepairsPage from "./pages/RepairsPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import HRPage from "./pages/HRPage";
import SettingsPage from "./pages/SettingsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import StocktakePage from "./pages/StocktakePage";
import OnlineStorePage from "./pages/OnlineStorePage";
import OnlineOrdersPage from "./pages/OnlineOrdersPage";
import PublicStorePage from "./pages/PublicStorePage";
import DailyClosingsPage from "./pages/DailyClosingsPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import WholesalePage from "./pages/WholesalePage";
import AuthPage from "./pages/AuthPage";
import LockedPage from "./pages/LockedPage";
import SupportPage from "./pages/SupportPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminCompaniesPage from "./pages/admin/AdminCompaniesPage";
import AdminBranchRequestsPage from "./pages/admin/AdminBranchRequestsPage";
import AdminPayoutsPage from "./pages/admin/AdminPayoutsPage";
import AdminPlansPage from "./pages/admin/AdminPlansPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import AdminTicketsPage from "./pages/admin/AdminTicketsPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminAuthPage from "./pages/admin/AdminAuthPage";
import OAuthConsentPage from "./pages/OAuthConsentPage";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

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
