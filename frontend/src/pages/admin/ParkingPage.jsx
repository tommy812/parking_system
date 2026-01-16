import React, { useEffect, useMemo, useState } from "react";
import TextField from "../../components/forms/TextField";
import { useAuth } from "../../context/AuthContext";
import { fetchAdminParkings, upsertParking } from "../../api/parkingApi";
import EntryCard from "./Components/EntryCard";

const emptyForm = {
  id: null,
  name: "",
  address: "",
  timezone: "Europe/London",
  capacity: "",
  currency: "GBP",
  image_url: "",
  owner_user_id: "",
};

export default function ParkingPage() {
  const { token } = useAuth();
  const [parkings, setParkings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const load = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminParkings({
        page: nextPage,
        pageSize,
        search,
        authHeader,
      });
      const list = Array.isArray(data) ? data : data?.data || data?.parkings || [];
      setParkings(list);
      setTotal(data?.total ?? null);
      setPage(nextPage);
    } catch (e) {
      setError(e.message || "Failed to load parkings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name || "",
      address: p.address || "",
      timezone: p.timezone || "Europe/London",
      capacity: p.capacity ?? "",
      currency: p.currency || "GBP",
      image_url: p.image_url || "",
      owner_user_id: p.owner_user_id || "",
    });
    setModalOpen(true);
  };

  const handleReset = () => {
    setForm(emptyForm);
    setError("");
    setModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!String(form.capacity).trim() || Number(form.capacity) <= 0) {
      setError("Capacity must be a positive integer");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await upsertParking({ form, authHeader });
      setParkings((prev) =>
        form.id ? prev.map((p) => (p.id === form.id ? data : p)) : [data, ...prev]
      );
      handleReset();
    } catch (e) {
      setError(e.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">All parkings</h2>
            <div className="flex items-center gap-2">
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
              {loading && <span className="loading loading-spinner" />}
              <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
                Add parking
              </button>
            </div>
          </div>
          {parkings.length === 0 && !loading ? (
            <p className="text-sm text-base-content/70">No parkings found.</p>
          ) : (
            <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-1 gap-4">
              {parkings.map((p) => (
                <EntryCard
                  key={p.id}
                  title={p.name}
                  image={p.image_url || "https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"}
                  active
                  capacity={p.capacity}
                  onClick={() => handleEdit(p)}
                  footer={
                    <div className="text-xs text-base-content/70">
                      {p.address || "No address"} • {p.currency || "GBP"}
                    </div>
                  }
                />
              ))}
            </div>
          )}

          <div className="join mt-4 justify-center">
            <button className="join-item btn" onClick={() => load({ page: Math.max(1, page - 1) })} disabled={page === 1 || loading}>
              «
            </button>
            <button className="join-item btn">Page {page}</button>
            <button
              className="join-item btn"
              onClick={() => load({ page: page + 1 })}
              disabled={loading || (total !== null && page * pageSize >= total) || (parkings.length < pageSize && total === null)}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Modal for add/edit */}
      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="modal-box max-w-4xl">
          <h3 className="font-bold text-lg mb-4">{form.id ? "Edit parking" : "Add parking"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <TextField label="Name" value={form.name} onChange={(v) => handleChange("name", v)} />
            <TextField
              label="Capacity"
              type="number"
              value={form.capacity}
              onChange={(v) => handleChange("capacity", v)}
            />
            <TextField label="Address" value={form.address} onChange={(v) => handleChange("address", v)} />
            <TextField
              label="Timezone"
              value={form.timezone}
              placeholder="Europe/London"
              onChange={(v) => handleChange("timezone", v)}
            />
            <TextField label="Currency" value={form.currency} onChange={(v) => handleChange("currency", v)} />
            <TextField
              label="Image URL"
              value={form.image_url}
              onChange={(v) => handleChange("image_url", v)}
            />
            <TextField
              label="Owner user id (optional)"
              value={form.owner_user_id}
              onChange={(v) => handleChange("owner_user_id", v)}
            />

            {error && <p className="text-error text-sm col-span-full">{error}</p>}

            <div className="flex gap-2 col-span-full">
              <button className={`btn btn-primary ${saving ? "loading" : ""}`} type="submit" disabled={saving}>
                {saving ? "Saving..." : form.id ? "Update parking" : "Create parking"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleReset} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleReset}>
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}