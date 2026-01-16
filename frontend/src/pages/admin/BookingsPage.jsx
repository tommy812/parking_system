import React, { useEffect, useMemo, useState } from "react";
import EntryCard from "./Components/EntryCard";
import { useAuth } from "../../context/AuthContext";

function BookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
  const load = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", nextPage);
      params.set("page_size", pageSize);
      if (search) params.set("query", search);

      const res = await fetch(`${apiBaseUrl}/bookings?${params.toString()}`, {
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to load bookings");
        return;
      }
      const list = Array.isArray(body) ? body : body?.bookings || [];
      setBookings(list);
      setTotal(body?.total ?? null);
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
  }, [token, search]);

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
              <li><a>Date</a></li>
              <li><a>Status</a></li>
              <li><a>User</a></li>
              <li><a>Parking</a></li>
            </ul>
          </div>

          <div className="dropdown dropdown-hover">
            <div tabIndex={0} role="button" className="btn m-1 btn-sm">Filter</div>
            <ul tabIndex="-1" className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
              <li><a><input type="checkbox" defaultChecked className="checkbox checkbox-sm" />All</a></li>
              <li><a><input type="checkbox" className="checkbox checkbox-sm" />Pending</a></li>
              <li><a><input type="checkbox" className="checkbox checkbox-sm" />Confirmed</a></li>
              <li><a><input type="checkbox" className="checkbox checkbox-sm" />Cancelled</a></li>
              <li><a><input type="checkbox" className="checkbox checkbox-sm" />Expired</a></li>
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
                    {b.start_at ? new Date(b.start_at).toLocaleString() : "—"} →{" "}
                    {b.end_at ? new Date(b.end_at).toLocaleString() : "—"}
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
        <button className="join-item btn">Page {page}</button>
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