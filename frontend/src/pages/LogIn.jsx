import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

const LogIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({}); // { email?, password?, auth? }
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!password.trim()) nextErrors.password = "Password is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    const response = await login(email, password);
    if (response.error) {
      setErrors({ auth: response.error });
      return;
    }
    const { token, user } = response;
    setAuth(token, user);
    navigate("/profile");
  };

  const clearFieldError = (field) => {
    setErrors((prev) => ({ ...prev, [field]: undefined, auth: undefined }));
  };

  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <fieldset className="fieldset bg-base-100 rounded-box w-xs border p-4 border-primary">
        <legend className="fieldset-legend text-xl">Login</legend>

        <label className="label">Email</label>
        <input
          type="email"
          className="input border-primary"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email || errors.auth) clearFieldError("email");
          }}
        />
        {errors.email && <p className="text-error text-sm mt-1">{errors.email}</p>}

        <label className="label">Password</label>
        <input
          type="password"
          className="input border-primary"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password || errors.auth) clearFieldError("password");
          }}
        />
        {errors.password && <p className="text-error text-sm mt-1">{errors.password}</p>}

        {errors.auth && <p className="text-error text-sm mt-2">{errors.auth}</p>}

        <Link to="/forgot-password" className="label justify-end mt-4 hover:text-primary">
          Forgot password?
        </Link>

        <button className="btn btn-neutral mt-4" onClick={handleLogin}>
          Login
        </button>
        <Link to="/signup" className="label justify-end mt-4 hover:text-primary">
          Don&apos;t have an account? Sign up
        </Link>
      </fieldset>
    </div>
  );
};

export default LogIn;