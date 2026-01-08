import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireRole({ roles = [], children }) {
  const { token, user } = useAuth();
  const location = useLocation();

  const allowed = token && user?.role && roles.includes(user.role);

  if (!allowed) {
    // no token or wrong role
    return <Navigate to="/*" replace state={{ from: location }} />;
    // optionally send to an Unauthorized page instead
  }

  return children;
}