import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import TextField from "../components/forms/TextField";

const LogIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({}); // { email?, password?, auth? }
  const [submitting, setSubmitting] = useState(false);
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!password.trim()) nextErrors.password = "Password is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const response = await login(email, password);
      if (response.error) {
        setErrors({ auth: response.error });
        return;
      }
      const { token, user } = response;
      setAuth(token, user);
      navigate("/profile");
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (field) => {
    setErrors((prev) => ({ ...prev, [field]: undefined, auth: undefined }));
  };

  return (
    <div className="flex justify-center items-center min-h-[50vh] px-4">
      <form onSubmit={handleLogin} className="w-full max-w-md">
        <fieldset className="fieldset bg-base-100 rounded-box w-full border p-4 border-primary">
          <legend className="fieldset-legend text-xl">Login</legend>

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

            <TextField
              label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (errors.password || errors.auth) clearFieldError("password");
              }}
              error={errors.password}
            />
          </div>

          {errors.auth && <p className="text-error text-sm mt-2">{errors.auth}</p>}

          <Link to="/password-forgot" className="label justify-end mt-4 hover:text-primary">
            Forgot password?
          </Link>

          <button className="btn btn-neutral mt-4 w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
          <Link to="/signup" className="label justify-end mt-4 hover:text-primary">
            Don&apos;t have an account? Sign up
          </Link>
        </fieldset>
      </form>
    </div>
  );
};

export default LogIn;