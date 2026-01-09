import React from "react";

export default function RoleToggleGroup({ label = "Role", options, value, onChange }) {
  return (
    <div className="form-control gap-2">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>

      <div className="join w-full content-center">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn join-item ${value === opt.value ? "btn-primary" : "btn-base"}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

