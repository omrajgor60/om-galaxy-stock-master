import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ScannerPage from "@/pages/ScannerPage";
import SalesPage from "@/pages/SalesPage";
import CustomersPage from "@/pages/CustomersPage";
import InventoryPage from "@/pages/InventoryPage";
import StaffPage from "@/pages/StaffPage";
import RequestsPage from "@/pages/RequestsPage";
import ExportPage from "@/pages/ExportPage";
import OutletsPage from "@/pages/OutletsPage";
import TransfersPage from "@/pages/TransfersPage";
import OutletReportsPage from "@/pages/OutletReportsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/transfers" element={<TransfersPage />} />
              <Route path="/outlet-reports" element={<OutletReportsPage />} />
              <Route path="/staff" element={<ProtectedRoute requireAdmin><StaffPage /></ProtectedRoute>} />
              <Route path="/outlets" element={<ProtectedRoute requireAdmin><OutletsPage /></ProtectedRoute>} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/export" element={<ProtectedRoute requireAdmin><ExportPage /></ProtectedRoute>} />
              <Route path="/report-issue" element={<RequestsPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
