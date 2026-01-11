import { Navigate, Outlet } from "react-router-dom";
import { useMode } from "@/contexts/ModeContext";

export default function AdminRoute() {
  const { isAdmin } = useMode();

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
