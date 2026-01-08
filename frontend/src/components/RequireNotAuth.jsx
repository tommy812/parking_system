import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireNotAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();

  if (token) {
    return <Navigate to="/profile" replace state={{ from: location }} />;
  }

  return children;
}

