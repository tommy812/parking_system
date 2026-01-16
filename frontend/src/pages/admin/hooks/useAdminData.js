import { useMemo } from "react";
import seeds from "../fixtures/adminSeeds";

export default function useAdminData() {
  const users = useMemo(() => seeds.users, []);
  const parkings = useMemo(() => seeds.parkings, []);
  const ownerRegistrations = useMemo(() => seeds.ownerRegistrations, []);

  const summary = useMemo(
    () => ({
      users: users.length,
      owners: users.filter((u) => u.role === "OWNER").length,
      parkings: parkings.length,
      bookings: seeds.summary.bookings,
      usersDelta: seeds.summary.usersDelta,
      ownersDelta: seeds.summary.ownersDelta,
      parkingsDelta: seeds.summary.parkingsDelta,
      bookingsDelta: seeds.summary.bookingsDelta,
    }),
    [users, parkings]
  );

  return { users, parkings, ownerRegistrations, summary };
}

