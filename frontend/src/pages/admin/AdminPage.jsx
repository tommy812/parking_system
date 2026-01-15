import React, { useMemo, useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import DashboardContent from "./DashboardContent";

const AdminPage = () => {
  // Mock data; replace with API data
  const users = useMemo(
    () => [
      { id: "u1", email: "admin@ex.com", phone: "07123456789", role: "ADMIN" },
      { id: "u2", email: "owner@ex.com", phone: "07000000000", role: "OWNER" },
      { id: "u3", email: "user@ex.com", phone: "", role: "USER" },
    ],
    []
  );

  const parkings = useMemo(
    () => [
      { id: "p1", name: "Downtown Garage", address: "123 Main St", capacity: 120, currency: "GBP" },
      { id: "p2", name: "Airport Long Stay", address: "Airport Rd", capacity: 400, currency: "GBP" },
    ],
    []
  );

  const ownerRegistrations = useMemo(
    () => [
      { id: "or1", user_id: "u2", parking_id: "p1", status: "PENDING", created_at: "2024-11-01T10:00:00Z" },
      { id: "or2", user_id: "u2", parking_id: "p2", status: "PENDING", created_at: "2024-11-02T09:30:00Z" },
    ],
    []
  );



  const summary = useMemo(
    () => ({
      users: users.length,
      owners: users.filter((u) => u.role === "OWNER").length,
      parkings: parkings.length,
      bookings: 142, // replace with API count
      usersDelta: 3,
      ownersDelta: 1,
      parkingsDelta: 2,
      bookingsDelta: 8,
    }),
    [users, parkings]
  );

  const location = useLocation();
  const isRoot = location.pathname === "/admin";
  const activePath = location.pathname;

  const title = useMemo(() => {
    if (activePath.startsWith("/admin/parkings")) return "Parkings";
    if (activePath.startsWith("/admin/users")) return "Users";
    if (activePath.startsWith("/admin/bookings")) return "Bookings";
    if (activePath.startsWith("/admin/settings")) return "Settings";
    return "Dashboard";
  }, [activePath]);



  const [theme, setTheme] = useState(
    localStorage.getItem("theme") ? localStorage.getItem("theme") : "light"
  );

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const localTheme = localStorage.getItem("theme");
    document.querySelector("html").setAttribute("data-theme", localTheme);
  }, [theme]);

  const handleTheme = (e) => {
    if (e.target.checked) {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-4" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        {/* Navbar */}
        <nav className="navbar w-screen  bg-primary text-primary-content">
          <label htmlFor="my-drawer-4" aria-label="open sidebar" className="btn btn-square btn-ghost">
            {/* Sidebar toggle icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path><path d="M9 4v16"></path><path d="M14 10l2 2l-2 2"></path></svg>
          </label>
          <div className="px-4 text-lg font-semibold">{title}</div>
          <div className="px-4 ">
            <label className="toggle text-base-content">
              <input
                type="checkbox"
                value="synthwave"
                className="theme-controller"
                onChange={handleTheme}
              />

              <svg
                aria-label="sun"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </g>
              </svg>

              <svg
                aria-label="moon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </g>
              </svg>
            </label>
          </div>
        </nav>
        {/* Page content here */}
        <div className="p-4">
          {isRoot ? (
            <DashboardContent
              summary={summary}
              ownerRegistrations={ownerRegistrations}
              parkings={parkings}
              users={users}
            />
          ) : (
            <Outlet />
          )}
        </div>
      </div>

      <div className="drawer-side is-drawer-close:overflow-visible">
        <label htmlFor="my-drawer-4" aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64">
          {/* Sidebar content here */}
          <ul className="menu w-full grow">
            <li className={activePath === "/admin" ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Dashboard" to="/admin">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                <span className="is-drawer-close:hidden">Dashboard</span>
              </Link>
            </li>

            <li className={activePath.startsWith("/admin/parkings") ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Parkings" to="/admin/parkings">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="my-1.5 inline-block size-4"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M10 8h3a3 3 0 0 1 0 6h-3z" />
                  <path d="M10 14v4" />
                </svg>
                <span className="is-drawer-close:hidden">Parkings</span>
              </Link>
            </li>

            <li className={activePath.startsWith("/admin/users") ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Users" to="/admin/users">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="my-1.5 inline-block size-4"
                >
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="17" cy="7" r="3" />
                  <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
                  <path d="M14 15h1a4 4 0 0 1 4 4v2" />
                </svg>
                <span className="is-drawer-close:hidden">Users</span>
              </Link>
            </li>

            <li className={activePath.startsWith("/admin/bookings") ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Bookings" to="/admin/bookings">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="my-1.5 inline-block size-4"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <path d="M9 16l2 2 4-4" />
                </svg>
                <span className="is-drawer-close:hidden">Bookings</span>
              </Link>
            </li>

            <li className={activePath.startsWith("/admin/payments") ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Payments" to="/admin/payments">
                {/* Payments icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="my-1.5 inline-block size-4"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                  <line x1="6" y1="15" x2="10" y2="15" />
                </svg>
                <span className="is-drawer-close:hidden">Payments</span>
              </Link>
            </li>

            <li className={activePath.startsWith("/admin/settings") ? "bg-primary text-primary-content rounded-lg" : "hover:bg-primary hover:text-primary-content rounded-full"}>
              <Link className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Settings" to="/admin/settings">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
                <span className="is-drawer-close:hidden">Settings</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;