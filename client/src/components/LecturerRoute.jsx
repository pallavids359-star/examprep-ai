import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLoading } from "./Skeleton";

// Lecturers and admins (head lecturers) get through
export default function LecturerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "lecturer" && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
