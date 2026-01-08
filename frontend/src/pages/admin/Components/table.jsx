import React from "react";

export default function Table({ registrations = [], parkings = [], users = [] }) {
  const parkingById = React.useMemo(() => Object.fromEntries(parkings.map((p) => [p.id, p])), [parkings]);
  const userById = React.useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Owner</th>
            <th>Parking</th>
            <th>Status</th>
            <th>Submitted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-sm text-base-content/70">
                No pending registrations
              </td>
            </tr>
          )}
          {registrations.map((r) => {
            const u = userById[r.user_id];
            const p = parkingById[r.parking_id];
            return (
              <tr key={r.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="bg-neutral text-neutral-content rounded-full w-10">
                        <span>{u?.email?.charAt(0)?.toUpperCase() || "U"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">{u?.email || "Unknown user"}</div>
                      <div className="text-xs text-base-content/60">{u?.phone || "No phone"}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="font-medium">{p?.name || "Unknown parking"}</div>
                  <div className="text-xs text-base-content/60">
                    {p?.address || "No address"} • cap {p?.capacity ?? "?"}
                  </div>
                </td>
                <td>
                  <span className="badge badge-outline">{r.status}</span>
                </td>
                <td className="text-sm text-base-content/70">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="flex gap-2">
                  <button className="btn btn-xs btn-success">Approve</button>
                  <button className="btn btn-xs btn-ghost">Reject</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}