import React, { useEffect, useMemo, useState } from "react";
import TextField from "../../components/forms/TextField";
import { useAuth } from "../../context/AuthContext";
import { GeoapifyContext, GeoapifyGeocoderAutocomplete } from "@geoapify/react-geocoder-autocomplete";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import {
  createParkingBlackout,
  createPricingTier,
  deactivatePricingTier,
  fetchAdminParkings,
  fetchParkingBlackouts,
  fetchParkingPricing,
  updateParkingBlackout,
  updatePricingTier,
  upsertParking,
  deleteParkingBlackout,
} from "../../api/parkingApi";
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
  is_active: true,
  lat: "",
  lng: "",
  open_start_minute_utc: 0,
  open_end_minute_utc: 1440,
  min_booking_minutes: 15,
  max_booking_minutes: 1440,
  buffer_minutes: 0,
};
const emptyTier = {
  id: null,
  max_minutes: "",
  price_pence: "",
  currency: "GBP",
  is_active: true,
};
const emptyBlackout = {
  id: null,
  start_at: "",
  end_at: "",
  reason: "",
};

export default function ParkingPage() {
  const { token } = useAuth();
  const [parkings, setParkings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extrasError, setExtrasError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("latest");
  const [search, setSearch] = useState("");
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const skeletonItems = useMemo(() => Array.from({ length: pageSize }, (_, i) => i), [pageSize]);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [newTier, setNewTier] = useState(emptyTier);
  const [newBlackout, setNewBlackout] = useState(emptyBlackout);
  const [extrasLoading, setExtrasLoading] = useState(false);

  const load = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminParkings({
        page: nextPage,
        pageSize,
        search,
        orderBy: orderFilter,
        filter: statusFilter,
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
  }, [token, search, orderFilter, statusFilter]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadExtras = async (parkingId) => {
    setExtrasLoading(true);
    setExtrasError("");
    try {
      const [tiers, blackoutRes] = await Promise.all([
        fetchParkingPricing({ parkingId, authHeader }),
        fetchParkingBlackouts({ parkingId, authHeader }),
      ]);
      setPricingTiers(Array.isArray(tiers) ? tiers : tiers?.tiers || []);
      setBlackouts(Array.isArray(blackoutRes) ? blackoutRes : blackoutRes?.blackouts || []);
    } catch (e) {
      setExtrasError(e.message || "Failed to load parking details");
    } finally {
      setExtrasLoading(false);
    }
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
      is_active: p.is_active ?? true,
      lat: p.lat ?? "",
      lng: p.lng ?? "",
      open_start_minute_utc: p.open_start_minute_utc ?? 0,
      open_end_minute_utc: p.open_end_minute_utc ?? 1440,
      min_booking_minutes: p.min_booking_minutes ?? 15,
      max_booking_minutes: p.max_booking_minutes ?? 1440,
      buffer_minutes: p.buffer_minutes ?? 0,
    });
    setPricingTiers([]);
    setBlackouts([]);
    setNewTier(emptyTier);
    setNewBlackout(emptyBlackout);
    if (p.id) loadExtras(p.id);
    setModalOpen(true);
  };

  const handleReset = () => {
    setForm(emptyForm);
    setError("");
    setExtrasError("");
    setPricingTiers([]);
    setBlackouts([]);
    setNewTier(emptyTier);
    setNewBlackout(emptyBlackout);
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

  const updateTierField = (index, field, value) => {
    setPricingTiers((prev) =>
      prev.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier))
    );
  };

  const handleSaveTier = async (tier) => {
    if (!form.id || !tier?.id) return;
    setExtrasError("");
    try {
      const updated = await updatePricingTier({
        parkingId: form.id,
        tierId: tier.id,
        tier: {
          max_minutes: tier.max_minutes,
          price_pence: tier.price_pence,
          currency: tier.currency,
          is_active: tier.is_active,
        },
        authHeader,
      });
      setPricingTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      setExtrasError(e.message || "Failed to update pricing tier");
    }
  };

  const handleDeactivateTier = async (tier) => {
    if (!form.id || !tier?.id) return;
    setExtrasError("");
    try {
      const updated = await deactivatePricingTier({
        parkingId: form.id,
        tierId: tier.id,
        authHeader,
      });
      setPricingTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      setExtrasError(e.message || "Failed to deactivate pricing tier");
    }
  };

  const handleAddTier = async () => {
    if (!form.id) return;
    if (!String(newTier.max_minutes).trim() || !String(newTier.price_pence).trim()) {
      setExtrasError("Tier max minutes and price are required");
      return;
    }
    setExtrasError("");
    try {
      const created = await createPricingTier({
        parkingId: form.id,
        tier: {
          max_minutes: Number(newTier.max_minutes),
          price_pence: Number(newTier.price_pence),
          currency: newTier.currency || "GBP",
        },
        authHeader,
      });
      setPricingTiers((prev) => [...prev, created]);
      setNewTier(emptyTier);
    } catch (e) {
      setExtrasError(e.message || "Failed to create pricing tier");
    }
  };

  const updateBlackoutField = (index, field, value) => {
    setBlackouts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveBlackout = async (blackout) => {
    if (!form.id || !blackout?.id) return;
    setExtrasError("");
    try {
      const updated = await updateParkingBlackout({
        parkingId: form.id,
        blackoutId: blackout.id,
        blackout: {
          start_at: blackout.start_at,
          end_at: blackout.end_at,
          reason: blackout.reason,
        },
        authHeader,
      });
      setBlackouts((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e) {
      setExtrasError(e.message || "Failed to update blackout");
    }
  };

  const handleDeleteBlackout = async (blackout) => {
    if (!form.id || !blackout?.id) return;
    setExtrasError("");
    try {
      await deleteParkingBlackout({
        parkingId: form.id,
        blackoutId: blackout.id,
        authHeader,
      });
      setBlackouts((prev) => prev.filter((b) => b.id !== blackout.id));
    } catch (e) {
      setExtrasError(e.message || "Failed to delete blackout");
    }
  };

  const handleAddBlackout = async () => {
    if (!form.id) return;
    if (!newBlackout.start_at || !newBlackout.end_at) {
      setExtrasError("Blackout start and end are required");
      return;
    }
    setExtrasError("");
    try {
      const created = await createParkingBlackout({
        parkingId: form.id,
        blackout: {
          start_at: newBlackout.start_at,
          end_at: newBlackout.end_at,
          reason: newBlackout.reason,
        },
        authHeader,
      });
      setBlackouts((prev) => [...prev, created]);
      setNewBlackout(emptyBlackout);
    } catch (e) {
      setExtrasError(e.message || "Failed to create blackout");
    }
  };

  const totalPages = total ? Math.ceil(total / pageSize) : null;
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
              {["latest", "oldest", "name", "location"].map(o => (
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
              {["all", "active", "inactive"].map(s => (
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
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setForm(emptyForm);
              setPricingTiers([]);
              setBlackouts([]);
              setNewTier(emptyTier);
              setNewBlackout(emptyBlackout);
              setError("");
              setExtrasError("");
              setModalOpen(true);
            }}
          >
            Add parking
          </button>
        </div>

      </div>


      {loading ? (
        <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-1 gap-4">
          {skeletonItems.map((key) => (
            <div key={key} className="flex w-52 flex-col gap-4">
              <div className="skeleton h-32 w-full"></div>
              <div className="skeleton h-4 w-28"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-full"></div>
            </div>
          ))}
        </div>
      ) : parkings.length === 0 ? (
        <p className="text-sm text-base-content/70">No parkings found.</p>
      ) : (
        <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-1 gap-4">
          {parkings.map((p) => (
            <EntryCard
              key={p.id}
              title={p.name}
              image={p.image_url || "https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"}
              active={p.is_active}
              capacity={p.capacity}
              onClick={() => handleEdit(p)}
              opening={p.open_start_minute_utc}
              closing={p.open_end_minute_utc}
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
        <button className="join-item btn" >
          Page {page}{totalPages ? ` of ${totalPages}` : ""}
        </button>
        <button
          className="join-item btn"
          onClick={() => load({ page: totalPages ? Math.min(totalPages, page + 1) : page + 1 })}
          disabled={loading || (totalPages ? page >= totalPages : false)}
        >
          »
        </button>
      </div>



      {/* Modal for add/edit */}
      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="modal-box max-w-4xl">
          <h3 className="font-bold text-lg mb-4">{form.id ? "Edit parking" : "Add parking"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <TextField label="Parking ID" value={form.id || ""} onChange={() => {}} readOnly />
            <TextField label="Name" value={form.name} onChange={(v) => handleChange("name", v)} />
            <TextField
              label="Capacity"
              type="number"
              value={form.capacity}
              onChange={(v) => handleChange("capacity", v)}
            />
            <TextField label="Owner user id" value={form.owner_user_id} onChange={(v) => handleChange("owner_user_id", v)} />
            <div className="form-control gap-2 grid grid-cols-1">
              <label className="label">
                <span className="label-text">Active</span>
              </label>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={Boolean(form.is_active)}
                onChange={(e) => handleChange("is_active", e.target.checked)}
              />
            </div>
            



            <div className="form-control gap-2 grid grid-cols-1">
              <label className="label">
                <span className="label-text">Address</span>
              </label>
              <GeoapifyContext apiKey={import.meta.env.VITE_GEOAPIFY_API_KEY}>
                <GeoapifyGeocoderAutocomplete
                  placeholder="Start typing an address..."
                  value={form.address}
                  inputClassName="input w-full input-bordered label border-primary"
                  placeSelect={(feature) => {
                    const p = feature?.properties;
                    if (!p) return;

                    handleChange("address", p.formatted || "");
                    handleChange("lat", p.lat ?? "");
                    handleChange("lng", p.lon ?? "");
                    if (p.timezone?.name) handleChange("timezone", p.timezone.name);
                  }}
                  suggestionsChange={() => {}}
                />
              </GeoapifyContext>
            </div>
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
            <TextField label="Latitude" value={form.lat} onChange={(v) => handleChange("lat", v)} />
            <TextField label="Longitude" value={form.lng} onChange={(v) => handleChange("lng", v)} />
            <TextField
              label="Open start minute (UTC)"
              type="number"
              value={form.open_start_minute_utc}
              onChange={(v) => handleChange("open_start_minute_utc", v)}
            />
            <TextField
              label="Open end minute (UTC)"
              type="number"
              value={form.open_end_minute_utc}
              onChange={(v) => handleChange("open_end_minute_utc", v)}
            />
            <TextField
              label="Min booking minutes"
              type="number"
              value={form.min_booking_minutes}
              onChange={(v) => handleChange("min_booking_minutes", v)}
            />
            <TextField
              label="Max booking minutes"
              type="number"
              value={form.max_booking_minutes}
              onChange={(v) => handleChange("max_booking_minutes", v)}
            />
            <TextField
              label="Buffer minutes"
              type="number"
              value={form.buffer_minutes}
              onChange={(v) => handleChange("buffer_minutes", v)}
            />

            {error && <p className="text-error text-sm col-span-full">{error}</p>}
            {extrasError && <p className="text-error text-sm col-span-full">{extrasError}</p>}

            {form.id && (
              <div className="col-span-full flex flex-col gap-4">
                <div className="divider">Pricing tiers</div>
                {extrasLoading ? (
                  <p className="text-sm text-base-content/70">Loading pricing tiers...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {pricingTiers.length === 0 ? (
                      <p className="text-sm text-base-content/70">No pricing tiers yet.</p>
                    ) : (
                      pricingTiers.map((tier, index) => {
                        const minutes = Number(tier.max_minutes) || 0;
                        const hours = minutes / 60;
                        const totalPrice = (Number(tier.price_pence) || 0) / 100;
                        const hourlyRate = hours > 0 ? totalPrice / hours : 0;
                        const durationLabel = hours >= 1 
                          ? `${hours % 1 === 0 ? hours : hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`
                          : `${minutes} minutes`;
                        
                        return (
                          <div key={tier.id} className="border rounded-lg p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                              <div>
                                <TextField
                                  label="Duration (minutes)"
                                  type="number"
                                  value={tier.max_minutes}
                                  onChange={(v) => updateTierField(index, "max_minutes", v)}
                                />
                                <p className="text-xs text-base-content/70 mt-1">
                                  Up to {durationLabel}
                                </p>
                              </div>
                              <div>
                                <TextField
                                  label="Total price (pence)"
                                  type="number"
                                  value={tier.price_pence}
                                  onChange={(v) => updateTierField(index, "price_pence", v)}
                                />
                                <p className="text-xs text-base-content/70 mt-1">
                                  Total: £{totalPrice.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <TextField
                                  label="Currency"
                                  value={tier.currency}
                                  onChange={(v) => updateTierField(index, "currency", v)}
                                />
                                {hours > 0 && (
                                  <p className="text-xs text-base-content/70 mt-1">
                                    Effective: £{hourlyRate.toFixed(2)}/hour
                                  </p>
                                )}
                              </div>
                              <div className="flex items-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleSaveTier(tier)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDeactivateTier(tier)}
                                >
                                  Deactivate
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div className="border rounded-lg p-3 space-y-3 border-dashed">
                      <div className="text-sm font-semibold text-base-content/70">Add new pricing tier</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <TextField
                            label="Duration (minutes)"
                            type="number"
                            value={newTier.max_minutes}
                            onChange={(v) => setNewTier((prev) => ({ ...prev, max_minutes: v }))}
                            placeholder="e.g., 60 for 1 hour"
                          />
                          {newTier.max_minutes && (
                            <p className="text-xs text-base-content/70 mt-1">
                              Up to {(() => {
                                const mins = Number(newTier.max_minutes) || 0;
                                const hrs = mins / 60;
                                return hrs >= 1 
                                  ? `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} ${hrs === 1 ? 'hour' : 'hours'}`
                                  : `${mins} minutes`;
                              })()}
                            </p>
                          )}
                        </div>
                        <div>
                          <TextField
                            label="Total price (pence)"
                            type="number"
                            value={newTier.price_pence}
                            onChange={(v) => setNewTier((prev) => ({ ...prev, price_pence: v }))}
                            placeholder="e.g., 500 for £5.00"
                          />
                          {newTier.price_pence && (
                            <p className="text-xs text-base-content/70 mt-1">
                              Total: £{((Number(newTier.price_pence) || 0) / 100).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div>
                          <TextField
                            label="Currency"
                            value={newTier.currency}
                            onChange={(v) => setNewTier((prev) => ({ ...prev, currency: v }))}
                          />
                          {newTier.max_minutes && newTier.price_pence && (
                            <p className="text-xs text-base-content/70 mt-1">
                              Effective: £{(() => {
                                const mins = Number(newTier.max_minutes) || 0;
                                const hrs = mins / 60;
                                const total = (Number(newTier.price_pence) || 0) / 100;
                                return hrs > 0 ? (total / hrs).toFixed(2) : '0.00';
                              })()}/hour
                            </p>
                          )}
                        </div>
                        <div className="flex items-end">
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTier}>
                            Add tier
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-base-content/60">
                        💡 Tip: Set discounted prices for longer durations. For example: 1 hour = £5, 2 hours = £9 (discounted), 4 hours = £16 (more discounted)
                      </p>
                    </div>
                  </div>
                )}

                <div className="divider">Parking blackouts</div>
                {extrasLoading ? (
                  <p className="text-sm text-base-content/70">Loading blackouts...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {blackouts.length === 0 ? (
                      <p className="text-sm text-base-content/70">No blackouts yet.</p>
                    ) : (
                      blackouts.map((blackout, index) => (
                        <div key={blackout.id} className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <TextField
                            label="Start (ISO)"
                            value={blackout.start_at}
                            onChange={(v) => updateBlackoutField(index, "start_at", v)}
                          />
                          <TextField
                            label="End (ISO)"
                            value={blackout.end_at}
                            onChange={(v) => updateBlackoutField(index, "end_at", v)}
                          />
                          <TextField
                            label="Reason"
                            value={blackout.reason}
                            onChange={(v) => updateBlackoutField(index, "reason", v)}
                          />
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleSaveBlackout(blackout)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDeleteBlackout(blackout)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    <div className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <TextField
                        label="Start (ISO)"
                        value={newBlackout.start_at}
                        onChange={(v) => setNewBlackout((prev) => ({ ...prev, start_at: v }))}
                      />
                      <TextField
                        label="End (ISO)"
                        value={newBlackout.end_at}
                        onChange={(v) => setNewBlackout((prev) => ({ ...prev, end_at: v }))}
                      />
                      <TextField
                        label="Reason"
                        value={newBlackout.reason}
                        onChange={(v) => setNewBlackout((prev) => ({ ...prev, reason: v }))}
                      />
                      <div className="flex items-end">
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleAddBlackout}>
                          Add blackout
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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