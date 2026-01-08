import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import LandPage from "./pages/LandPage";
import ProfilePage from "./pages/ProfilePage";
import LogIn from "./pages/LogIn";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import SignUp from "./pages/SignUp";
import BookinsPage from "./pages/BookinsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/admin/AdminPage";
import NotFound from "./pages/NotFound";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <LandPage /> },
      { path: "profile",element:(<RequireAuth> <ProfilePage /> </RequireAuth>) },
      { path: "bookings", element: (<RequireAuth> <BookinsPage /> </RequireAuth>) },
      { path: "settings", element: (<RequireAuth> <SettingsPage /> </RequireAuth>) },
      { path: "admin", element: (<RequireRole roles={["ADMIN"]}> <AdminPage /> </RequireRole>) },
      { path: "login", element: <LogIn /> },
      { path: "signup", element: <SignUp /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
