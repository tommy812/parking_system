import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchCurrentUser, updateProfile, updateVehicle } from "../api/userApi";
import { lookupVehicle } from "../api/vehicleApi";
import TextField from "../components/forms/TextField";
import { GeoapifyContext, GeoapifyGeocoderAutocomplete } from "@geoapify/react-geocoder-autocomplete";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";

const ProfilePage = () => {
  const { user: authUser, getAuthHeader, setUser } = useAuth();
  const [user, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({ account: false, vehicle: false });
  const [saving, setSaving] = useState({ account: false, vehicle: false });
  const [error, setError] = useState({ account: "", vehicle: "" });
  const [success, setSuccess] = useState({ account: "", vehicle: "" });
  const [lookingUp, setLookingUp] = useState(false);

  const [accountForm, setAccountForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
  });

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_reg: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_year: "",
  });

  useEffect(() => {
    const loadUser = async () => {
      if (!authUser) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const authHeader = getAuthHeader();
        if (!authHeader.Authorization) {
          throw new Error("Not authenticated. Please log in again.");
        }
        const userData = await fetchCurrentUser({ authHeader });
        setUserData(userData);
        setAccountForm({
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          phone: userData.phone || "",
          address: userData.address || "",
        });
        setVehicleForm({
          vehicle_reg: userData.vehicle_reg || "",
          vehicle_model: userData.vehicle_model || "",
          vehicle_color: userData.vehicle_color || "",
          vehicle_year: userData.vehicle_year || "",
        });
      } catch (err) {
        console.error(err);
        setError((prev) => ({ ...prev, account: err.message || "Failed to load profile" }));
        if (err.message.includes("Not authenticated") || err.message.includes("Missing bearer token")) {
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [authUser, getAuthHeader]);

  const handleAccountChange = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
    setError((prev) => ({ ...prev, account: "" }));
    setSuccess((prev) => ({ ...prev, account: "" }));
  };

  const handleVehicleChange = (field, value) => {
    setVehicleForm((prev) => ({ ...prev, [field]: value }));
    setError((prev) => ({ ...prev, vehicle: "" }));
    setSuccess((prev) => ({ ...prev, vehicle: "" }));
  };

  const handleLookupVehicle = async () => {
    if (!vehicleForm.vehicle_reg.trim()) {
      setError((prev) => ({ ...prev, vehicle: "Please enter a registration number" }));
      return;
    }

    try {
      setLookingUp(true);
      setError((prev) => ({ ...prev, vehicle: "" }));
      const authHeader = getAuthHeader();
      if (!authHeader.Authorization) {
        throw new Error("Not authenticated");
      }
      const vehicleData = await lookupVehicle({
        registration: vehicleForm.vehicle_reg,
        authHeader,
      });

      setVehicleForm((prev) => ({
        ...prev,
        vehicle_model: vehicleData.model || prev.vehicle_model,
        vehicle_color: vehicleData.color || prev.vehicle_color,
        vehicle_year: vehicleData.year || prev.vehicle_year,
      }));

      if (vehicleData._mock) {
        setSuccess((prev) => ({
          ...prev,
          vehicle: "Vehicle details found (mock data)",
        }));
      } else {
        setSuccess((prev) => ({ ...prev, vehicle: "Vehicle details found" }));
      }
    } catch (err) {
      console.error(err);
      setError((prev) => ({
        ...prev,
        vehicle: err.message || "Failed to lookup vehicle details",
      }));
    } finally {
      setLookingUp(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      setSaving((prev) => ({ ...prev, account: true }));
      setError((prev) => ({ ...prev, account: "" }));
      setSuccess((prev) => ({ ...prev, account: "" }));

      const authHeader = getAuthHeader();
      if (!authHeader.Authorization) {
        throw new Error("Not authenticated");
      }
      const updatedUser = await updateProfile({
        first_name: accountForm.first_name || undefined,
        last_name: accountForm.last_name || undefined,
        phone: accountForm.phone || undefined,
        address: accountForm.address || undefined,
        authHeader,
      });

      setUserData(updatedUser);
      setUser(updatedUser);
      setEditing((prev) => ({ ...prev, account: false }));
      setSuccess((prev) => ({ ...prev, account: "Account information updated successfully" }));
    } catch (err) {
      console.error(err);
      setError((prev) => ({ ...prev, account: err.message || "Failed to update account information" }));
    } finally {
      setSaving((prev) => ({ ...prev, account: false }));
    }
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      setSaving((prev) => ({ ...prev, vehicle: true }));
      setError((prev) => ({ ...prev, vehicle: "" }));
      setSuccess((prev) => ({ ...prev, vehicle: "" }));

      const authHeader = getAuthHeader();
      if (!authHeader.Authorization) {
        throw new Error("Not authenticated");
      }
      const updatedUser = await updateVehicle({
        vehicle_reg: vehicleForm.vehicle_reg || undefined,
        vehicle_model: vehicleForm.vehicle_model || undefined,
        vehicle_color: vehicleForm.vehicle_color || undefined,
        vehicle_year: vehicleForm.vehicle_year ? Number(vehicleForm.vehicle_year) : undefined,
        authHeader,
      });

      setUserData(updatedUser);
      setUser(updatedUser);
      setEditing((prev) => ({ ...prev, vehicle: false }));
      setSuccess((prev) => ({ ...prev, vehicle: "Vehicle details updated successfully" }));
    } catch (err) {
      console.error(err);
      setError((prev) => ({ ...prev, vehicle: err.message || "Failed to update vehicle details" }));
    } finally {
      setSaving((prev) => ({ ...prev, vehicle: false }));
    }
  };

  const handleCancelEdit = (section) => {
    if (section === "account") {
      setAccountForm({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        phone: user?.phone || "",
        address: user?.address || "",
      });
    } else if (section === "vehicle") {
      setVehicleForm({
        vehicle_reg: user?.vehicle_reg || "",
        vehicle_model: user?.vehicle_model || "",
        vehicle_color: user?.vehicle_color || "",
        vehicle_year: user?.vehicle_year || "",
      });
    }
    setEditing((prev) => ({ ...prev, [section]: false }));
    setError((prev) => ({ ...prev, [section]: "" }));
    setSuccess((prev) => ({ ...prev, [section]: "" }));
  };

  const handleResetPassword = () => {
    window.location.href = "/password-forgot";
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4 text-base-content/70">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="alert alert-error">
            <span>Failed to load profile. Please try logging in again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Account Information Section */}
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="card-title text-xl">Account information</h2>
                <p className="text-sm text-base-content/70 mt-1">
                  You can edit your profile information below. Clicking on the reset password button will send a reset link to your email.
                </p>
              </div>
              {!editing.account && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setEditing((prev) => ({ ...prev, account: true }))}
                >
                  Edit
                </button>
              )}
            </div>

            {error.account && (
              <div className="alert alert-error mb-4">
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
                <span>{error.account}</span>
              </div>
            )}

            {success.account && (
              <div className="alert alert-success mb-4">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{success.account}</span>
              </div>
            )}

            {editing.account ? (
              <form onSubmit={handleSaveAccount} className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="First name"
                    value={accountForm.first_name}
                    onChange={(v) => handleAccountChange("first_name", v)}
                    placeholder="e.g., Thomas"
                  />
                  <TextField
                    label="Last name"
                    value={accountForm.last_name}
                    onChange={(v) => handleAccountChange("last_name", v)}
                    placeholder="e.g., Tamagni"
                  />
                </div>

                <TextField
                  label="Phone number"
                  value={accountForm.phone}
                  onChange={(v) => handleAccountChange("phone", v)}
                  placeholder="e.g., +44 123 456 7890"
                />

                <div>
                  <TextField
                    label="Email Address"
                    value={user.email || ""}
                    onChange={() => {}}
                    readOnly
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm text-success">Email verified</span>
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Password</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleResetPassword}
                  >
                    Reset Password
                  </button>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleCancelEdit("account")}
                    disabled={saving.account}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving.account}>
                    {saving.account ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">First name</label>
                    <p className="text-lg">{user.first_name || <span className="text-base-content/50">Not provided</span>}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Last name</label>
                    <p className="text-lg">{user.last_name || <span className="text-base-content/50">Not provided</span>}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-base-content/70">Phone number</label>
                  <p className="text-lg">{user.phone || <span className="text-base-content/50">Not provided</span>}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-base-content/70">Email Address</label>
                  <div className="flex items-center gap-2">
                    <p className="text-lg">{user.email}</p>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm text-success">Verified</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-base-content/70">Password</label>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-2"
                    onClick={handleResetPassword}
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="card-title text-xl">Address</h2>
                <p className="text-sm text-base-content/70 mt-1">
                  Your billing and delivery address
                </p>
              </div>
              {!editing.account && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setEditing((prev) => ({ ...prev, account: true }))}
                >
                  Edit
                </button>
              )}
            </div>

            {editing.account ? (
              <form onSubmit={handleSaveAccount} className="space-y-4 mt-6">
                <div className="form-control gap-2">
                  <label className="label">
                    <span className="label-text">Address</span>
                  </label>
                  <GeoapifyContext apiKey={import.meta.env.VITE_GEOAPIFY_API_KEY}>
                    <GeoapifyGeocoderAutocomplete
                      placeholder="Start typing an address..."
                      value={accountForm.address}
                      inputClassName="input w-full input-bordered border-primary"
                      placeSelect={(feature) => {
                        const p = feature?.properties;
                        if (!p) return;
                        handleAccountChange("address", p.formatted || "");
                      }}
                      suggestionsChange={() => {}}
                    />
                  </GeoapifyContext>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleCancelEdit("account")}
                    disabled={saving.account}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving.account}>
                    {saving.account ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6">
                <label className="text-sm font-semibold text-base-content/70">Address</label>
                <p className="text-lg">{user.address || <span className="text-base-content/50">Not provided</span>}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Section */}
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-xl mb-2">Payment method</h2>
            <p className="text-sm text-base-content/70 mb-6">
              Manage your payment methods for faster checkout
            </p>

            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>Payment methods are managed during checkout. Add a card when making your next booking.</span>
            </div>
          </div>
        </div>

        {/* Vehicle Details Section */}
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="card-title text-xl">Vehicles</h2>
                <p className="text-sm text-base-content/70 mt-1">
                  Your most recently used vehicle is listed below. Enter a registration number to automatically fill vehicle details.
                </p>
              </div>
              {!editing.vehicle && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setEditing((prev) => ({ ...prev, vehicle: true }))}
                >
                  Edit
                </button>
              )}
            </div>

            {error.vehicle && (
              <div className="alert alert-error mb-4">
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
                <span>{error.vehicle}</span>
              </div>
            )}

            {success.vehicle && (
              <div className="alert alert-success mb-4">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{success.vehicle}</span>
              </div>
            )}

            {user.vehicle_reg && (
              <div className="card bg-base-200 border border-base-300 mb-4">
                <div className="card-body p-4">
                  <div className="flex items-center gap-4">
                    <div className="avatar placeholder">
                      <div className="bg-primary text-primary-content rounded-lg w-16">
                        <span className="text-2xl">🚗</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{user.vehicle_reg}</div>
                      <div className="text-sm text-base-content/70">
                        {user.vehicle_model || "No model specified"}
                      </div>
                      {(user.vehicle_color || user.vehicle_year) && (
                        <div className="text-xs text-base-content/60">
                          {user.vehicle_color && user.vehicle_color}
                          {user.vehicle_color && user.vehicle_year && " • "}
                          {user.vehicle_year && user.vehicle_year}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editing.vehicle ? (
              <form onSubmit={handleSaveVehicle} className="space-y-4 mt-6">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextField
                      label="Registration Number"
                      value={vehicleForm.vehicle_reg}
                      onChange={(v) => handleVehicleChange("vehicle_reg", v)}
                      placeholder="e.g., WN15HDV"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleLookupVehicle}
                      disabled={lookingUp || !vehicleForm.vehicle_reg.trim()}
                    >
                      {lookingUp ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Looking up...
                        </>
                      ) : (
                        "Lookup"
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Model"
                    value={vehicleForm.vehicle_model}
                    onChange={(v) => handleVehicleChange("vehicle_model", v)}
                    placeholder="e.g., Fiesta Titanium X"
                  />
                  <TextField
                    label="Color"
                    value={vehicleForm.vehicle_color}
                    onChange={(v) => handleVehicleChange("vehicle_color", v)}
                    placeholder="e.g., Blue"
                  />
                  <TextField
                    label="Year"
                    type="number"
                    value={vehicleForm.vehicle_year}
                    onChange={(v) => handleVehicleChange("vehicle_year", v)}
                    placeholder="e.g., 2015"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleCancelEdit("vehicle")}
                    disabled={saving.vehicle}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving.vehicle}>
                    {saving.vehicle ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              !user.vehicle_reg && (
                <div className="mt-6 text-center text-base-content/70">
                  <p>No vehicle registered. Click Edit to add your vehicle.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
