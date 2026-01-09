import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as apiRegister, checkEmailExists } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import TextField from "../components/forms/TextField";
import RoleToggleGroup from "../components/forms/RoleToggleGroup";

const roleOptions = [
  { value: "USER", label: "User" },
  { value: "OWNER", label: "Parking Space Owner" },
];

export default function SignUp() {
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "USER",
    phone: "",
    vehicle_reg: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_year: "",
    parking: {
      name: "",
      address: "",
      timezone: "",
      capacity: "",
      currency: "GBP",
      image_url: "",
    },
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [step, setStep] = useState(0); // 0 credentials, 1 vehicle, 2 owner toggle, 3 parking (if owner)
  const [checkingEmail, setCheckingEmail] = useState(false);

  const isOwner = useMemo(() => form.role === "OWNER", [form.role]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, auth: undefined }));
  };

  const handleParkingChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      parking: { ...prev.parking, [field]: value },
    }));
    const errorKey = `parking_${field}`;
    setErrors((prev) => ({ ...prev, [errorKey]: undefined, auth: undefined, parking: undefined }));
  };

  const validateStep = (s = step) => {
    const next = {};
    if (s === 0) {
      if (!form.email.trim()) next.email = "Email is required";
      if (!form.password.trim() || form.password.length < 8)
        next.password = "Password must be at least 8 characters";
    } else if (s === 3 && isOwner) {
      if (!form.parking.name.trim()) next.parking_name = "Parking name is required";
      if (!String(form.parking.capacity).trim()) next.parking_capacity = "Parking capacity is required";
    }
    return next;
  };

  const handleNext = async () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    // Step 0: check email availability
    if (step === 0) {
      setCheckingEmail(true);
      try {
        const res = await checkEmailExists(form.email);
        if (res?.exists) {
          setErrors((prev) => ({ ...prev, email: "Email already registered" }));
          return;
        }
      } finally {
        setCheckingEmail(false);
      }
    }

    const nextStep = step + 1;
    // if moving past owner question and user is USER, skip parking step
    if (nextStep === 3 && !isOwner) {
      setStep(2);
      return;
    }
    setStep(nextStep);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSuccessMsg("");
    const nextErrors = {
      ...validateStep(0),
      ...(isOwner ? validateStep(3) : {}),
    };
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone || undefined,
        vehicle_reg: form.vehicle_reg || undefined,
        vehicle_model: form.vehicle_model || undefined,
        vehicle_color: form.vehicle_color || undefined,
        vehicle_year: form.vehicle_year || undefined,
        parking: isOwner
          ? {
              name: form.parking.name,
              address: form.parking.address || undefined,
              timezone: form.parking.timezone || undefined,
              capacity: form.parking.capacity ? Number(form.parking.capacity) : undefined,
              currency: form.parking.currency || undefined,
              image_url: form.parking.image_url || undefined,
            }
          : undefined,
      };

      const response = await apiRegister(payload);
      if (response.error) {
        const msg = response.error.toLowerCase();
        if (msg.includes("email")) setErrors((p) => ({ ...p, email: response.error }));
        else if (msg.includes("password")) setErrors((p) => ({ ...p, password: response.error }));
        else if (msg.includes("capacity")) setErrors((p) => ({ ...p, parking_capacity: response.error }));
        else if (msg.includes("parking") || msg.includes("name"))
          setErrors((p) => ({ ...p, parking_name: response.error }));
        else setErrors((p) => ({ ...p, auth: response.error }));
        return;
      }

      if (response.token && response.user) {
        setAuth(response.token, response.user);
        navigate("/profile");
        return;
      }

      setSuccessMsg("Owner registration submitted. An admin will review and approve your parking.");
      navigate("/login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-4xl">
        <fieldset className="fieldset bg-base-100 rounded-box w-full border p-6 md:p-8 border-primary shadow-lg">
          <legend className="fieldset-legend text-2xl font-semibold">Sign up</legend>

          <ul className="steps w-full mb-6">
            <li className={`step ${step >= 0 ? "step-primary" : ""}`}>Credentials</li>
            <li className={`step ${step >= 1 ? "step-primary" : ""}`}>Vehicle</li>
            <li className={`step ${step >= 2 ? "step-primary" : ""}`}>Owner?</li>
            <li className={`step ${step >= 3 ? "step-primary" : ""}`}>Parking details</li>
          </ul>

          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <TextField
                label="Email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(v) => handleChange("email", v)}
                error={errors.email}
              />

              <TextField
                label="Password"
                type="password"
                placeholder="Password (min 8 chars)"
                value={form.password}
                onChange={(v) => handleChange("password", v)}
                error={errors.password}
              />

              <TextField
                label="Phone"
                type="tel"
                placeholder="Optional"
                value={form.phone}
                onChange={(v) => handleChange("phone", v)}
                error={errors.phone}
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <TextField
                label="Vehicle Registration"
                placeholder="e.g. ABC123"
                value={form.vehicle_reg}
                onChange={(v) => handleChange("vehicle_reg", v)}
                error={errors.vehicle_reg}
              />
              <TextField
                label="Vehicle Model"
                placeholder="e.g. Tesla Model 3"
                value={form.vehicle_model}
                onChange={(v) => handleChange("vehicle_model", v)}
                error={errors.vehicle_model}
              />
              <TextField
                label="Vehicle Color"
                placeholder="e.g. Blue"
                value={form.vehicle_color}
                onChange={(v) => handleChange("vehicle_color", v)}
                error={errors.vehicle_color}
              />
              <TextField
                label="Vehicle Year"
                type="number"
                placeholder="e.g. 2020"
                value={form.vehicle_year}
                onChange={(v) => handleChange("vehicle_year", v)}
                error={errors.vehicle_year}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 content-centermd:grid-cols-2 gap-4 md:gap-6 ">
              <RoleToggleGroup
                options={roleOptions}
                value={form.role}
                onChange={(v) => handleChange("role", v)}
              />
            </div>
          )}

          {step === 3 && isOwner && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <TextField
                  label="Name"
                  placeholder="Parking name"
                  value={form.parking.name}
                  onChange={(v) => handleParkingChange("name", v)}
                  error={errors.parking_name}
                />
                <TextField
                  label="Capacity"
                  type="number"
                  placeholder="Total spots"
                  value={form.parking.capacity}
                  onChange={(v) => handleParkingChange("capacity", v)}
                  error={errors.parking_capacity}
                />
                <TextField
                  label="Address"
                  placeholder="Address"
                  value={form.parking.address}
                  onChange={(v) => handleParkingChange("address", v)}
                />
                <TextField
                  label="Timezone"
                  placeholder="e.g. Europe/London"
                  value={form.parking.timezone}
                  onChange={(v) => handleParkingChange("timezone", v)}
                />
                <TextField
                  label="Currency"
                  placeholder="GBP"
                  value={form.parking.currency}
                  onChange={(v) => handleParkingChange("currency", v)}
                />
                <TextField
                  label="Image URL"
                  placeholder="Optional"
                  value={form.parking.image_url}
                  onChange={(v) => handleParkingChange("image_url", v)}
                />
              </div>
              {errors.parking_name && <p className="text-error text-sm mt-1">{errors.parking_name}</p>}
              {errors.parking_capacity && <p className="text-error text-sm mt-1">{errors.parking_capacity}</p>}
            </>
          )}

          {errors.auth && <p className="text-error text-sm mt-2">{errors.auth}</p>}
          {successMsg && <p className="text-success text-sm mt-2">{successMsg}</p>}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link to="/login" className="link link-primary text-sm">
              Already have an account? Log in
            </Link>
            
            <div className="flex gap-2">
              {step > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  Back
                </button>
              )}
              {step < (isOwner ? 3 : 2) && (
                <button
                  type="button"
                  className={`btn btn-primary ${step === 0 && checkingEmail ? "loading" : ""}`}
                  onClick={handleNext}
                  disabled={step === 0 && checkingEmail}
                >
                  {step === 0 && checkingEmail ? "Checking..." : "Next"}
                </button>
              )}
            

            {step === (isOwner ? 3 : 2) && (
              <button
                type="submit"
                className={`btn btn-neutral ${submitting ? "btn-disabled" : ""}`}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Sign up"}
              </button>
            )}
            </div>

           
          </div>
        </fieldset>
      </form>
    </div>
  );
}