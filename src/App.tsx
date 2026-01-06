import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ModeProvider } from "@/contexts/ModeContext";
import AppLayout from "@/components/layout/AppLayout";
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
import IncomingStockPage from "@/pages/IncomingStockPage";
import OutletReportsPage from "@/pages/OutletReportsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ModeProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/transfers" element={<TransfersPage />} />
              <Route path="/incoming-stock" element={<IncomingStockPage />} />
              <Route path="/outlet-reports" element={<OutletReportsPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/outlets" element={<OutletsPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/report-issue" element={<RequestsPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
