import React from "react";

export default function TextField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  inputClassName = "",
  disabled = false,
  readOnly = false,
}) {
  return (
    <div className="form-control gap-2 grid grid-cols-1">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>

      <input
        type={type}
        className={`input w-full input-bordered label border-primary ${inputClassName}`}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
      />

      {error ? <p className="text-error text-sm mt-1">{error}</p> : <span className="mt-[20px]"></span>}

    </div>
  );
}

