import React, { useMemo, useState, useEffect } from "react";
import Card from "./components/Card";
import Table from "./components/Table";
import { Link } from "react-router-dom";
import { fetchNumberofParkings } from "../../api/parkingApi";
import { useAuth } from "../../context/AuthContext";
import { fetchNumberOfUsers } from "../../api/userApi";
import { fetchNumberOfOwners } from "../../api/userApi";
import { fetchNumberOfBookings } from "../../api/bookingApi";


export default function DashboardContent({ summary = {}, ownerRegistrations = [], parkings = [], users = [] }) {
  const { token } = useAuth();
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [numberOfParkings, setNumberOfParkings] = useState(0);
  const [numberOfUsers, setNumberOfUsers] = useState(0);
  const [numberOfOwners, setNumberOfOwners] = useState(0);
  const [numberOfBookings, setNumberOfBookings] = useState(0);


  const loadNumberOfParkings = async () => {
    try {
      const data = await fetchNumberofParkings({ authHeader });
      setNumberOfParkings(data.total);
    } catch (error) {
      console.error(error);
    }
  };
  const loadNumberOfUsers = async () => {
    try {
      const data = await fetchNumberOfUsers({ authHeader });
      setNumberOfUsers(data.total);
    } catch (error) {
      console.error(error);
    }
  };
  const loadNumberOfOwners = async () => {
    try {
      const data = await fetchNumberOfOwners({ authHeader });
      setNumberOfOwners(data.total);
    } catch (error) {
      console.error(error);
    }
  };

  const loadNumberOfBookings = async () => {
    try {
      const data = await fetchNumberOfBookings({ authHeader });
      setNumberOfBookings(data.total);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadNumberOfParkings();

    loadNumberOfUsers();
    loadNumberOfOwners();
    loadNumberOfBookings();
  }, [token]);

  const cards = useMemo(
    () => [
      { title: "Users", value: numberOfUsers ?? 0, delta: summary.usersDelta ?? 0 },
      { title: "Owners", value: numberOfOwners ?? 0, delta: summary.ownersDelta ?? 0 },
      { title: "Parkings", value: numberOfParkings ?? 0, delta: summary.parkingsDelta ?? 0 },
      { title: "Bookings", value: numberOfBookings ?? 0, delta: summary.bookingsDelta ?? 0 },
    ],
    [numberOfUsers, numberOfOwners, numberOfParkings, numberOfBookings] 
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.title} title={c.title} value={c.value} badge={c.delta} />
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