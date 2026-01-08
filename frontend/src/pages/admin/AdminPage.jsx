import React, { useMemo } from "react";
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

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-4" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        {/* Navbar */}
        <nav className="navbar w-full bg-primary text-primary-content">
          <label htmlFor="my-drawer-4" aria-label="open sidebar" className="btn btn-square btn-ghost">
            {/* Sidebar toggle icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path><path d="M9 4v16"></path><path d="M14 10l2 2l-2 2"></path></svg>
          </label>
          <div className="px-4" >Admin Panel</div>
        </nav>
        {/* Page content here */}
        <div className="p-4">
          <DashboardContent
            summary={summary}
            ownerRegistrations={ownerRegistrations}
            parkings={parkings}
            users={users}
          />
        </div>
      </div>

      <div className="drawer-side is-drawer-close:overflow-visible">
        <label htmlFor="my-drawer-4" aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64">
          {/* Sidebar content here */}
          <ul className="menu w-full grow">
            {/* List item */}
            <li>
              <button className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Homepage">
                {/* Home icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                <span className="is-drawer-close:hidden">Homepage</span>
              </button>
            </li>

            {/* List item */}
            <li>
              <button className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Settings">
                {/* Settings icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="my-1.5 inline-block size-4"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
                <span className="is-drawer-close:hidden">Settings</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AdminPage