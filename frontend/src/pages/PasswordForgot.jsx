import React, { useState } from "react";
import { Link } from "react-router-dom";
import TextField from "../components/forms/TextField";

const PasswordForgot = () => {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const clearFieldError = (field) => {
    setErrors((prev) => ({ ...prev, [field]: undefined, auth: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");

    const next = validate();
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    // TODO: hook up real forgot-password API
    setTimeout(() => {
      setSuccessMsg("If an account exists for that email, a reset link was sent.");
      setSubmitting(false);
    }, 500);
  };

  return (
    <div className="flex justify-center items-center min-h-[50vh] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <fieldset className="fieldset bg-base-100 rounded-box w-full border p-4 border-primary">
          <legend className="fieldset-legend text-xl">Reset password</legend>

          <div className="grid grid-cols-1 gap-4">
            <TextField
              label="Email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(v) => {
                setEmail(v);
                if (errors.email || errors.auth) clearFieldError("email");
              }}
              error={errors.email}
            />
          </div>

          {errors.auth && <p className="text-error text-sm mt-2">{errors.auth}</p>}
          {successMsg && <p className="text-success text-sm mt-2">{successMsg}</p>}

          <button type="submit" className="btn btn-neutral mt-4 w-full" disabled={submitting}>
            {submitting ? "Sending..." : "Reset Password"}
          </button>
          <Link to="/login" className="label justify-end mt-4 hover:text-primary">
            have an account? Log In
          </Link>
        </fieldset>
      </form>
    </div>
  );
};

export default PasswordForgot;