import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import LandPage from "./pages/LandPage";
import ProfilePage from "./pages/ProfilePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <LandPage /> },
      { path: "profile", element: <ProfilePage /> }
    ],
  },
]);
