import React, { useEffect, useMemo, useState } from "react";
import EntryCard from "./Components/EntryCard";
import { useAuth } from "../../context/AuthContext";
import { fetchAdminBookings } from "../../api/bookingApi";

function BookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("latest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const load = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const { bookings: list, total: count } = await fetchAdminBookings({
        page: nextPage,
        pageSize,
        search,
        orderFilter,
        filter: statusFilter,
        authHeader,
      });
      setBookings(list);
      setTotal(count);
      setPage(nextPage);
    } catch (e) {
      setError(e.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, orderFilter, statusFilter]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    if (total !== null && newPage > Math.ceil(total / pageSize)) return;
    load(newPage);
  };

  return (
    <div className="max-w-full shadow p-4 rounded-lg flex flex-col gap-4 justify-around items-center">
      <div className="w-full flex flex-wrap justify-between items-center gap-2">
        <div className="flex justify-start md:gap-1 items-center gap-2">
          <label className="input input-sm">
            <svg className="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </g>
            </svg>
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="dropdown dropdown-hover">
                <div tabIndex={0} role="button" className="btn m-1 btn-sm">Order</div>
                <ul tabIndex="-1" className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
                  {["latest", "oldest", "user", "name", "location"].map(o => (
                    <li key={o}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="order"
                          className="radio radio-sm"
                          checked={orderFilter === o}
                          onChange={() => setOrderFilter(o)}
                        />
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>



              <div className="dropdown dropdown-hover">
                <div tabIndex={0} role="button" className="btn m-1 btn-sm">Filter</div>
                <ul tabIndex="-1" className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
                  {["all", "pending", "confirmed", "cancelled", "expired"].map(s => (
                    <li key={s}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          className="radio radio-sm"
                          checked={statusFilter === s}
                          onChange={() => setStatusFilter(s)}
                        />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

       

        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm">Add Booking</button>
        </div>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-1 gap-4">
        {bookings.length === 0 && !loading ? (
          <p className="text-sm text-base-content/70 col-span-full">No bookings found.</p>
        ) : (
          bookings.map((b) => (
            <EntryCard
              key={b.id}
              title={`Booking ${b.id?.slice?.(0, 6) || b.id || ""}`}
              image="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
              active={b.status === "CONFIRMED"}
              capacity={b.total_amount_pence ? `${(b.total_amount_pence / 100).toFixed(2)} ${b.currency || ""}` : ""}
              footer={
                <div className="text-xs text-base-content/70 space-y-0.5">
                  <div>Status: {b.status || "—"}</div>
                  <div>User: {b.user_id || "—"}</div>
                  <div>Parking: {b.parking_id || "—"}</div>
                  <div>
                    {b.start_ats} to {b.end_at}
                  </div>
                </div>
              }
            />
          ))
        )}
      </div>

      <div className="join">
        <button className="join-item btn" onClick={() => handlePageChange(page - 1)} disabled={page === 1 || loading}>
          «
        </button>
        <button className="join-item btn">Page {page} </button>
        <button
          className="join-item btn"
          onClick={() => handlePageChange(page + 1)}
          disabled={
            loading ||
            (total !== null && page * pageSize >= total) ||
            (total === null && bookings.length < pageSize)
          }
        >
          »
        </button>
      </div>
    </div>
  );
}

export default BookingsPage;