import React from "react";

export default function Card({ title, description, badge }) {
  const positive = Number(badge) >= 0;
  return (
    <div className="card border bg-base-100 w-full">
      <div className="card-body">
        <h2 className="text-sm uppercase tracking-wide text-base-content/70">{title}</h2>
        <p className="card-title text-3xl font-semibold">{description}</p>
        <p className="text-sm text-base-content/70">
          <span className={positive ? "text-success" : "text-error"}>
            {positive ? "+" : ""}
            {badge}
          </span>{" "}
          vs last period
        </p>
      </div>
    </div>
  );
}