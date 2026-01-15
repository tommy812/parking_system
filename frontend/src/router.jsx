import { createBrowserRouter } from "react-router-dom";
{/* Root layout */}
import RootLayout from "./layouts/RootLayout";
import LandPage from "./pages/LandPage";

{/* Auth pages */}
import LogIn from "./pages/LogIn";
import RequireAuth from "./components/RequireAuth";
import RequireNotAuth from "./components/RequireNotAuth";
import RequireRole from "./components/RequireRole";
import SignUp from "./pages/SignUp";

{/* User pages */}
import ProfilePage from "./pages/ProfilePage";
import BookinsPage from "./pages/BookinsPage";
import SettingsPage from "./pages/SettingsPage";

{/* Admin pages */}
import NotFound from "./pages/NotFound";
import PasswordForgot from "./pages/PasswordForgot";
import AdminPage from "./pages/admin/AdminPage";
import AdminPaymentsPage from "./pages/admin/PaymentsPage";
import AdminParkingPage from "./pages/admin/ParkingPage";
import AdminBookingsPage from "./pages/admin/BookingsPage";
import AdminUsersPage from "./pages/admin/UsersPage";
import AdminSettingsPage from "./pages/admin/SettingsPage";



export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <LandPage /> },
      { path: "profile",element:(<RequireAuth> <ProfilePage /> </RequireAuth>) },
      { path: "bookings", element: (<RequireAuth> <BookinsPage /> </RequireAuth>) },
      { path: "settings", element: (<RequireAuth> <SettingsPage /> </RequireAuth>) },
      { path: "password-forgot", element: (<RequireNotAuth> <PasswordForgot /> </RequireNotAuth>) },
      { path: "login", element: (<RequireNotAuth> <LogIn /> </RequireNotAuth>) },
      { path: "signup", element: (<RequireNotAuth> <SignUp /> </RequireNotAuth>) },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "admin",
    element: (
      <RequireRole roles={["ADMIN"]}>
        <AdminPage />
      </RequireRole>
    ),
    children: [
      { index: true, element: <div /> }, // AdminPage renders dashboard by default
      { path: "parkings", element: <AdminParkingPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "bookings", element: <AdminBookingsPage /> },
      { path: "payments", element: <AdminPaymentsPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
    ],
  },
]);
