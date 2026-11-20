import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLoading } from "./Skeleton";

// Like ProtectedRoute, but only admins get through
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to={user.role === "lecturer" ? "/lecturer" : "/dashboard"} replace />;
  return children;
}