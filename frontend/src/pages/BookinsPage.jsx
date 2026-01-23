import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchMyBookings, cancelBooking } from "../api/bookingApi";
import { fetchParkings } from "../api/parkingApi";

const BookinsPage = () => {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [parkings, setParkings] = useState({}); // Map of parking_id -> parking object
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("latest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const skeletonItems = useMemo(() => Array.from({ length: pageSize }, (_, i) => i), [pageSize]);

  const load = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    setLoading(true);
    setError("");

    if (!user) {
      navigate("/login");
      return;
    }

    try {
      const authHeader = getAuthHeader();

      if (!authHeader.Authorization) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Fetch user bookings with filters
      const result = await fetchMyBookings({
        page: nextPage,
        pageSize,
        search,
        orderBy: orderFilter,
        filter: statusFilter,
        authHeader,
      });

      setBookings(result.bookings);
      setTotal(result.total);
      setPage(nextPage);

      // Fetch parking details for all unique parking IDs
      const parkingIds = [...new Set(result.bookings.map((b) => b.parking_id))];
      if (parkingIds.length > 0) {
        const { parkings: allParkings } = await fetchParkings({});
        const parkingMap = {};
        allParkings.forEach((p) => {
          parkingMap[p.id] = p;
        });
        setParkings(parkingMap);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      load({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, orderFilter, statusFilter]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    if (total !== null && newPage > Math.ceil(total / pageSize)) return;
    load({ page: newPage });
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      setCancellingId(bookingId);
      const authHeader = getAuthHeader();
      await cancelBooking({ booking_id: bookingId, authHeader });

      // Update the booking status locally
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" } : b))
      );
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatPrice = (pence, currency = "GBP") => {
    if (!pence) return "—";
    const amount = (Number(pence) / 100).toFixed(2);
    return `£${amount} ${currency}`;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: "badge-warning",
      CONFIRMED: "badge-success",
      CANCELLED: "badge-error",
      EXPIRED: "badge-neutral",
    };
    return statusMap[status] || "badge-neutral";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/")}
          >
            Book New Parking
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-6">
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
                placeholder="Search bookings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <div className="dropdown dropdown-hover">
              <div tabIndex={0} role="button" className="btn m-1 btn-sm">
                Order
              </div>
              <ul
                tabIndex="-1"
                className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
              >
                {[
                  { value: "latest", label: "Latest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "start_earliest", label: "Start Earliest" },
                  { value: "start_latest", label: "Start Latest" },
                  { value: "price_low", label: "Price: Low to High" },
                  { value: "price_high", label: "Price: High to Low" },
                ].map((o) => (
                  <li key={o.value}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="order"
                        className="radio radio-sm"
                        checked={orderFilter === o.value}
                        onChange={() => setOrderFilter(o.value)}
                      />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="dropdown dropdown-hover">
              <div tabIndex={0} role="button" className="btn m-1 btn-sm">
                Filter
              </div>
              <ul
                tabIndex="-1"
                className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
              >
                {["all", "pending", "confirmed", "cancelled", "expired"].map((s) => (
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
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skeletonItems.map((key) => (
              <div key={key} className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="skeleton h-48 w-full"></div>
                <div className="card-body">
                  <div className="skeleton h-4 w-3/4 mb-2"></div>
                  <div className="skeleton h-4 w-full mb-2"></div>
                  <div className="skeleton h-4 w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 mx-auto text-base-content/30 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h2 className="text-xl font-semibold mb-2">
                {search || statusFilter !== "all" ? "No bookings found" : "No bookings yet"}
              </h2>
              <p className="text-base-content/70 mb-4">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Start by booking a parking space to see your reservations here."}
              </p>
              {!search && statusFilter === "all" && (
                <button className="btn btn-primary" onClick={() => navigate("/")}>
                  Find Parking
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {bookings.map((booking) => {
                const parking = parkings[booking.parking_id];
                const canCancel = booking.status === "PENDING";

                return (
                <div
                  key={booking.id}
                  className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow"
                >
                  {parking?.imageUrl && (
                    <figure className="h-48 overflow-hidden">
                      <img
                        src={parking.imageUrl}
                        alt={parking.name || "Parking"}
                        className="w-full h-full object-cover"
                      />
                    </figure>
                  )}
                  <div className="card-body">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="card-title text-lg">
                        {parking?.name || `Parking ${booking.parking_id?.slice(0, 8) || ""}`}
                      </h2>
                      <div className={`badge ${getStatusBadge(booking.status)}`}>
                        {booking.status}
                      </div>
                    </div>

                    {parking?.address && (
                      <p className="text-sm text-base-content/70 mb-3">
                        {parking.address}
                      </p>
                    )}

                    <div className="space-y-2 text-sm mb-4">
                      <div>
                        <span className="font-semibold text-base-content/70">From:</span>{" "}
                        <span className="text-base-content">{formatDateTime(booking.start_at)}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-base-content/70">Until:</span>{" "}
                        <span className="text-base-content">{formatDateTime(booking.end_at)}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-base-content/70">Total:</span>{" "}
                        <span className="text-base-content font-semibold">
                          {formatPrice(booking.total_amount_pence, booking.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="card-actions justify-end">
                      {canCancel && (
                        <button
                          className="btn btn-error btn-sm"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                        >
                          {cancellingId === booking.id ? (
                            <>
                              <span className="loading loading-spinner loading-xs"></span>
                              Cancelling...
                            </>
                          ) : (
                            "Cancel Booking"
                          )}
                        </button>
                      )}
                      {booking.status === "CONFIRMED" && (
                        <div className="badge badge-success badge-sm">Confirmed</div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Pagination */}
            {total !== null && total > pageSize && (
              <div className="join flex justify-center mt-6">
                <button
                  className="join-item btn"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                >
                  «
                </button>
                <button className="join-item btn">
                  Page {page} of {Math.ceil(total / pageSize)}
                </button>
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BookinsPage;
