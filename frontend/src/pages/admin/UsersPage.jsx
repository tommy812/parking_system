import React, { useEffect, useMemo, useState } from "react";
import EntryCard from "./Components/EntryCard";
import { useAuth } from "../../context/AuthContext";
import { fetchAdminUsers } from "../../api/userApi";

function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("latest");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const skeletonItems = useMemo(() => Array.from({ length: pageSize }, (_, i) => i), [pageSize]);

  const load = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    setLoading(true);
    setError("");
    try {
      const { users: list, total: count } = await fetchAdminUsers({
        page: nextPage,
        pageSize,
        search,
        orderBy: orderFilter,
        filter: roleFilter,
        authHeader,
      });
      setUsers(list);
      setTotal(count);
      setPage(nextPage);
    } catch (e) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, orderFilter, roleFilter]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    if (total !== null && newPage > Math.ceil(total / pageSize)) return;
    load({ page: newPage });
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      ADMIN: "badge-error",
      OWNER: "badge-warning",
      USER: "badge-success",
    };
    return roleMap[role] || "badge-neutral";
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="dropdown dropdown-hover">
            <div tabIndex={0} role="button" className="btn m-1 btn-sm">
              Order
            </div>
            <ul tabIndex="-1" className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
              {[
                { value: "latest", label: "Latest" },
                { value: "oldest", label: "Oldest" },
                { value: "email_asc", label: "Email: A-Z" },
                { value: "email_desc", label: "Email: Z-A" },
                { value: "name_asc", label: "Name: A-Z" },
                { value: "name_desc", label: "Name: Z-A" },
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
            <ul tabIndex="-1" className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
              {["all", "user", "owner", "admin"].map((r) => (
                <li key={r}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      className="radio radio-sm"
                      checked={roleFilter === r}
                      onChange={() => setRoleFilter(r)}
                    />
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm">Add User</button>
        </div>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-1 gap-4">
        {loading ? (
          skeletonItems.map((key) => (
            <div key={key} className="flex w-52 flex-col gap-4">
              <div className="skeleton h-32 w-full"></div>
              <div className="skeleton h-4 w-28"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-full"></div>
            </div>
          ))
        ) : users.length === 0 ? (
          <p className="text-sm text-base-content/70 col-span-full">No users found.</p>
        ) : (
          users.map((u) => (
            <EntryCard
              key={u.id}
              title={u.display_name || u.email}
              image={u.image_url || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(u.email)}
              active={u.is_approved !== false}
              footer={
                <div className="text-xs text-base-content/70 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span>Role:</span>
                    <span className={`badge ${getRoleBadge(u.role)} badge-xs`}>{u.role}</span>
                  </div>
                  <div>Email: {u.email || "—"}</div>
                  {u.phone && <div>Phone: {u.phone}</div>}
                  {u.vehicle_reg && <div>Vehicle: {u.vehicle_reg}</div>}
                  {u.role === "OWNER" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span>Status:</span>
                      <span className={`badge ${u.is_approved ? "badge-success" : "badge-warning"} badge-xs`}>
                        {u.is_approved ? "Approved" : "Pending"}
                      </span>
                    </div>
                  )}
                  <div className="mt-1">Joined: {formatDateTime(u.created_at)}</div>
                </div>
              }
            />
          ))
        )}
      </div>

      <div className="join">
        <button
          className="join-item btn"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1 || loading}
        >
          «
        </button>
        <button className="join-item btn">
          Page {page} {total !== null && `of ${Math.ceil(total / pageSize)}`}
        </button>
        <button
          className="join-item btn"
          onClick={() => handlePageChange(page + 1)}
          disabled={
            loading ||
            (total !== null && page * pageSize >= total) ||
            (total === null && users.length < pageSize)
          }
        >
          »
        </button>
      </div>
    </div>
  );
}

export default UsersPage;
