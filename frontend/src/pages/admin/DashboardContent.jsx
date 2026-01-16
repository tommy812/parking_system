import React, { useMemo } from "react";
import Card from "./components/Card";
import Table from "./components/Table";
import { Link } from "react-router-dom";

export default function DashboardContent({ summary = {}, ownerRegistrations = [], parkings = [], users = [] }) {
  const cards = useMemo(
    () => [
      { title: "Users", value: summary.users ?? 0, delta: summary.usersDelta ?? 0 },
      { title: "Owners", value: summary.owners ?? 0, delta: summary.ownersDelta ?? 0 },
      { title: "Parkings", value: summary.parkings ?? 0, delta: summary.parkingsDelta ?? 0 },
      { title: "Bookings", value: summary.bookings ?? 0, delta: summary.bookingsDelta ?? 0 },
    ],
    [summary]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.title} title={c.title} description={c.value} badge={c.delta} />
        ))}
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title">Owner registration requests</h2>
              <p className="text-sm text-base-content/70">Latest requests with parking details</p>
            </div>
            <div>
              <button className="btn btn-primary"><Link to="/admin/Users">View All</Link></button>
            </div>
          </div>
          <Table registrations={ownerRegistrations} parkings={parkings} users={users} />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title">Owner registration requests</h2>
              <p className="text-sm text-base-content/70">Latest requests with parking details</p>
            </div>
            <div>
              <button className="btn btn-primary"><Link to="/admin/payments">View All</Link></button>
            </div>
          </div>
          <Table registrations={parkings} parkings={parkings} users={users} />
        </div>
      </div>


    </div>
    
  );
}