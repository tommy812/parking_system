// scripts/seed_realistic.js
import { pool } from "../src/config/db.js";
import { faker as Faker } from "@faker-js/faker";
import crypto from "crypto";

const faker = Faker;

// -------------------- knobs --------------------
const SEED = Number(process.env.SEED_SEED || 42);
const TRUNCATE = process.env.SEED_TRUNCATE === "true";
const DRY_RUN = process.env.DRY_RUN === "true";

const ADMIN_COUNT = Number(process.env.SEED_ADMINS || 2);
const OWNER_COUNT = Number(process.env.SEED_OWNERS || 30);
const USER_COUNT = Number(process.env.SEED_USERS || 400);

const MIN_PARKINGS_PER_OWNER = Number(process.env.SEED_MIN_PARKINGS_PER_OWNER || 1);
const MAX_PARKINGS_PER_OWNER = Number(process.env.SEED_MAX_PARKINGS_PER_OWNER || 3);

const BOOKING_TARGET = Number(process.env.SEED_BOOKINGS || 3000);
const BOOKING_MAX_ATTEMPTS = Number(process.env.SEED_BOOKING_MAX_ATTEMPTS || 25000);

const BLACKOUT_PROB_PER_PARKING = Number(process.env.SEED_BLACKOUT_PROB || 0.35);

faker.seed(SEED);

// -------------------- utils --------------------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function jitter(base, j = 0.08) {
  return base + (Math.random() * 2 - 1) * j;
}

function minuteOfDay(h, m) {
  return h * 60 + m;
}

function makeOpenHours() {
  const mode = pick(["24h", "office", "longday"]);
  if (mode === "24h") return { open_start_minute_utc: 0, open_end_minute_utc: 1440 };
  if (mode === "office") return { open_start_minute_utc: minuteOfDay(7, 0), open_end_minute_utc: minuteOfDay(20, 0) };
  return { open_start_minute_utc: minuteOfDay(6, 0), open_end_minute_utc: minuteOfDay(23, 0) };
}

function fakeStripe(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function roundToStep(n, step = 15) {
  return Math.max(step, Math.round(n / step) * step);
}

const UK_CITIES = [
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Manchester", lat: 53.4808, lng: -2.2426 },
  { name: "Birmingham", lat: 52.4862, lng: -1.8904 },
  { name: "Leeds", lat: 53.8008, lng: -1.5491 },
  { name: "Bristol", lat: 51.4545, lng: -2.5879 },
  { name: "Liverpool", lat: 53.4084, lng: -2.9916 },
  { name: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  { name: "Glasgow", lat: 55.8642, lng: -4.2518 },
  { name: "Cardiff", lat: 51.4816, lng: -3.1791 },
  { name: "Newcastle", lat: 54.9783, lng: -1.6178 },
];

function makePricingTiersGBP() {
  // Must be unique per (parking_id, max_minutes)
  return [
    { max_minutes: 60, price_pence: randInt(200, 700) },
    { max_minutes: 120, price_pence: randInt(500, 1200) },
    { max_minutes: 240, price_pence: randInt(900, 2000) },
    { max_minutes: 480, price_pence: randInt(1600, 3500) },
    { max_minutes: 1440, price_pence: randInt(2500, 6500) },
  ];
}

function priceForMinutes(tiers, minutes) {
  const sorted = tiers.slice().sort((a, b) => a.max_minutes - b.max_minutes);
  const tier = sorted.find((t) => minutes <= t.max_minutes) || sorted[sorted.length - 1];
  return tier.price_pence;
}

// -------------------- db helpers --------------------
async function truncateAll(client) {
  await client.query(`
    TRUNCATE
      payments,
      bookings,
      pricing_tiers,
      parking_blackouts,
      owner_registrations,
      parkings,
      users
    RESTART IDENTITY CASCADE;
  `);
}

async function insertUsers(client, users) {
  // DDL columns:
  // id (default), email, password_hash, role, phone, created_at (default),
  // vehicle_reg, vehicle_model, vehicle_color, vehicle_year, is_approved, image_url (new)
  const values = [];
  const placeholders = users.map((u, i) => {
    const base = i * 10;
    values.push(
      u.email,
      u.password_hash,
      u.role,
      u.phone,
      u.vehicle_reg,
      u.vehicle_model,
      u.vehicle_color,
      u.vehicle_year,
      u.is_approved,
      u.image_url
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  });

  const sql = `
    INSERT INTO users (
      email, password_hash, role, phone,
      vehicle_reg, vehicle_model, vehicle_color, vehicle_year,
      is_approved, image_url
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (email) DO UPDATE SET
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      vehicle_reg = EXCLUDED.vehicle_reg,
      vehicle_model = EXCLUDED.vehicle_model,
      vehicle_color = EXCLUDED.vehicle_color,
      vehicle_year = EXCLUDED.vehicle_year,
      is_approved = EXCLUDED.is_approved,
      image_url = EXCLUDED.image_url
    RETURNING id, email, role;
  `;

  const res = await client.query(sql, values);
  const userIdByEmail = new Map(res.rows.map((r) => [r.email, r.id]));
  const adminIds = res.rows.filter((r) => r.role === "ADMIN").map((r) => r.id);
  return { userIdByEmail, adminIds };
}

async function insertParkings(client, parkings, userIdByEmail) {
  const values = [];
  const placeholders = parkings.map((p, i) => {
    const base = i * 15;
    const ownerId = userIdByEmail.get(p.owner_email) || null;
    values.push(
      p.name,
      p.address,
      p.timezone,
      p.capacity,
      p.currency,
      p.image_url,
      ownerId,
      p.is_active,
      p.lat,
      p.lng,
      p.open_start_minute_utc,
      p.open_end_minute_utc,
      p.min_booking_minutes,
      p.max_booking_minutes,
      p.buffer_minutes
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15})`;
  });

  const sql = `
    INSERT INTO parkings (
      name, address, timezone, capacity, currency, image_url,
      owner_user_id, is_active, lat, lng,
      open_start_minute_utc, open_end_minute_utc,
      min_booking_minutes, max_booking_minutes, buffer_minutes
    )
    VALUES ${placeholders.join(",")}
    RETURNING id, name, is_active;
  `;

  const res = await client.query(sql, values);
  const parkingIdByName = new Map(res.rows.map((r) => [r.name, r.id]));
  const activeParkingNames = res.rows.filter((r) => r.is_active).map((r) => r.name);
  return { parkingIdByName, activeParkingNames };
}

async function insertPricingTiers(client, pricingRows, parkingIdByName) {
  const rows = pricingRows
    .map((t) => {
      const parkingId = parkingIdByName.get(t.parking_ref_name);
      if (!parkingId) return null;
      return { parkingId, ...t };
    })
    .filter(Boolean);

  if (!rows.length) return;

  const values = [];
  const placeholders = rows.map((r, i) => {
    const base = i * 5;
    values.push(r.parkingId, r.max_minutes, r.price_pence, r.currency, r.is_active);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  const sql = `
    INSERT INTO pricing_tiers (parking_id, max_minutes, price_pence, currency, is_active)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (parking_id, max_minutes) DO UPDATE SET
      price_pence = EXCLUDED.price_pence,
      currency = EXCLUDED.currency,
      is_active = EXCLUDED.is_active;
  `;
  await client.query(sql, values);
}

async function insertBlackouts(client, blackouts, parkingIdByName) {
  const rows = blackouts
    .map((b) => {
      const parkingId = parkingIdByName.get(b.parking_ref_name);
      if (!parkingId) return null;
      return { parkingId, ...b };
    })
    .filter(Boolean);

  if (!rows.length) return;

  const values = [];
  const placeholders = rows.map((r, i) => {
    const base = i * 4;
    values.push(r.parkingId, r.start_at, r.end_at, r.reason);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  const sql = `
    INSERT INTO parking_blackouts (parking_id, start_at, end_at, reason)
    VALUES ${placeholders.join(",")};
  `;
  await client.query(sql, values);
}

async function insertOwnerRegistrations(client, regs, userIdByEmail, parkingIdByName, adminIds) {
  const reviewerId = adminIds.length ? pick(adminIds) : null;

  const rows = regs
    .map((r) => {
      const userId = userIdByEmail.get(r.owner_email);
      const parkingId = parkingIdByName.get(r.parking_ref_name);
      if (!userId || !parkingId) return null;
      const reviewedAt = r.status === "APPROVED" || r.status === "REJECTED" ? new Date() : null;
      return {
        userId,
        parkingId,
        status: r.status,
        reviewed_by: reviewerId,
        reviewed_at: reviewedAt,
        note: r.note,
      };
    })
    .filter(Boolean);

  if (!rows.length) return;

  const values = [];
  const placeholders = rows.map((r, i) => {
    const base = i * 6;
    values.push(r.userId, r.parkingId, r.status, r.reviewed_by, r.reviewed_at, r.note);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const sql = `
    INSERT INTO owner_registrations (user_id, parking_id, status, reviewed_by, reviewed_at, note)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (user_id) DO NOTHING;
  `;
  await client.query(sql, values);
}

async function insertBookingsAndPayments(client, bookings, payments, userIdByEmail, parkingIdByName) {
  // Insert bookings in batches and RETURNING id so we can link payments.
  const BATCH = 500;
  const bookingIds = [];

  for (let offset = 0; offset < bookings.length; offset += BATCH) {
    const slice = bookings.slice(offset, offset + BATCH);

    const values = [];
    const placeholders = slice.map((b, i) => {
      const base = i * 8;
      values.push(
        userIdByEmail.get(b.user_email),
        parkingIdByName.get(b.parking_ref_name),
        b.start_at,
        b.end_at,
        b.status, // booking_status enum accepts these strings
        b.total_amount_pence,
        b.currency,
        b.stripe_payment_intent_id
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    });

    const sql = `
      INSERT INTO bookings (
        user_id, parking_id, start_at, end_at, status,
        total_amount_pence, currency, stripe_payment_intent_id
      )
      VALUES ${placeholders.join(",")}
      RETURNING id;
    `;

    const res = await client.query(sql, values);
    bookingIds.push(...res.rows.map((r) => r.id));
  }

  // Payments: 1 per booking
  const payValues = [];
  const payPlaceholders = payments.map((p, i) => {
    const base = i * 6;
    payValues.push(
      bookingIds[i],
      p.provider,
      p.provider_payment_id,
      p.status, // payment_status enum
      p.amount_pence,
      JSON.stringify(p.raw ?? {})
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const paySql = `
    INSERT INTO payments (
      booking_id, provider, provider_payment_id, status, amount_pence, raw
    )
    VALUES ${payPlaceholders.join(",")};
  `;
  await client.query(paySql, payValues);
}

// -------------------- seed generation --------------------
function buildSeedData() {
  const users = [];
  const admins = [];
  const owners = [];
  const customers = [];

  const makeEmail = (tag) => `${tag}.${faker.string.alphanumeric(10).toLowerCase()}@example.com`;

  // Admins
  for (let i = 0; i < ADMIN_COUNT; i++) {
    const u = {
      email: makeEmail("admin"),
      password_hash: "seeded_password_hash",
      role: "ADMIN",
      phone: faker.phone.number(),
      vehicle_reg: null,
      vehicle_model: null,
      vehicle_color: null,
      vehicle_year: null,
      is_approved: true,
      image_url: faker.image.avatar(),
    };
    users.push(u); admins.push(u);
  }

  // Owners
  for (let i = 0; i < OWNER_COUNT; i++) {
    const approved = Math.random() < 0.8;
    const u = {
      email: makeEmail("owner"),
      password_hash: "seeded_password_hash",
      role: "OWNER",
      phone: faker.phone.number(),
      vehicle_reg: faker.vehicle.vrm(),
      vehicle_model: faker.vehicle.model(),
      vehicle_color: faker.color.human(),
      vehicle_year: randInt(2008, 2025),
      is_approved: approved,
      image_url: faker.image.avatar(),
    };
    users.push(u); owners.push(u);
  }

  // Customers
  for (let i = 0; i < USER_COUNT; i++) {
    const u = {
      email: makeEmail("user"),
      password_hash: "seeded_password_hash",
      role: "USER",
      phone: faker.phone.number(),
      vehicle_reg: faker.vehicle.vrm(),
      vehicle_model: faker.vehicle.model(),
      vehicle_color: faker.color.human(),
      vehicle_year: randInt(2005, 2025),
      is_approved: true,
      image_url: faker.image.avatar(),
    };
    users.push(u); customers.push(u);
  }

  // Parkings + owner registrations + pricing tiers + blackouts
  const parkings = [];
  const ownerRegistrations = [];
  const pricingTiers = [];
  const blackouts = [];

  for (const owner of owners) {
    const parkingCount = randInt(MIN_PARKINGS_PER_OWNER, MAX_PARKINGS_PER_OWNER);

    for (let k = 0; k < parkingCount; k++) {
      const city = pick(UK_CITIES);
      const { open_start_minute_utc, open_end_minute_utc } = makeOpenHours();

      // Respect parkings_schedule_check
      const min_booking_minutes = pick([15, 30, 60]);
      const max_booking_minutes = pick([240, 480, 720, 1440]);
      const buffer_minutes = pick([0, 0, 10, 15]);

      const is_active = owner.is_approved ? Math.random() < 0.92 : false;

      const parking = {
        owner_email: owner.email,
        is_active,
        name: `${faker.company.name()} Car Park`,
        address: `${faker.location.streetAddress()}, ${city.name}`,
        timezone: "Europe/London",
        capacity: randInt(20, 220),
        currency: "GBP",
        image_url: faker.image.urlPicsumPhotos({ width: 1200, height: 800 }),
        lat: jitter(city.lat, 0.06),
        lng: jitter(city.lng, 0.08),
        open_start_minute_utc,
        open_end_minute_utc,
        min_booking_minutes,
        max_booking_minutes,
        buffer_minutes,
      };

      parkings.push(parking);

      // One registration per owner (unique user_id)
      if (!ownerRegistrations.some((r) => r.owner_email === owner.email)) {
        const status = owner.is_approved ? "APPROVED" : pick(["PENDING", "REJECTED", "PENDING"]);
        ownerRegistrations.push({
          owner_email: owner.email,
          parking_ref_name: parking.name,
          status,
          note: status === "REJECTED" ? "Missing documentation" : null,
        });
      }

      // Pricing tiers
      const tiers = makePricingTiersGBP().map((t) => ({
        parking_ref_name: parking.name,
        max_minutes: t.max_minutes,
        price_pence: t.price_pence,
        currency: "GBP",
        is_active: true,
      }));
      pricingTiers.push(...tiers);

      // Blackouts sometimes
      if (Math.random() < BLACKOUT_PROB_PER_PARKING) {
        const start = faker.date.soon({ days: 30 });
        const durationHours = randInt(2, 24);
        const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
        blackouts.push({
          parking_ref_name: parking.name,
          start_at: start,
          end_at: end,
          reason: pick(["Maintenance", "Event", "Resurfacing", "Electrical works", "Private booking"]),
        });
      }
    }
  }

  // Bookings + payments
  // Important: EXCLUDE constraint prevents overlap for same (user_id, parking_id) when status is PENDING or CONFIRMED.
  // We'll generate bookings now, but final insert might still fail if we accidentally overlap.
  // We'll reduce overlaps by:
  // - tracking pending/confirmed ranges per user+parking in memory
  // - retrying generation
  const activeParkings = parkings.filter((p) => p.is_active);
  const parkingsForBooking = activeParkings.length ? activeParkings : parkings;

  const pricingIndex = new Map();
  for (const t of pricingTiers) {
    const key = t.parking_ref_name;
    if (!pricingIndex.has(key)) pricingIndex.set(key, []);
    pricingIndex.get(key).push({ max_minutes: t.max_minutes, price_pence: t.price_pence });
  }

  const bookings = [];
  const payments = [];

  // Map key: `${userEmail}::${parkingName}` -> [{start, end}]
  const reserved = new Map();

  function overlapsExisting(userEmail, parkingName, start, end) {
    const key = `${userEmail}::${parkingName}`;
    const ranges = reserved.get(key);
    if (!ranges) return false;
    for (const r of ranges) {
      if (start < r.end && r.start < end) return true;
    }
    return false;
  }

  function reserveRange(userEmail, parkingName, start, end) {
    const key = `${userEmail}::${parkingName}`;
    if (!reserved.has(key)) reserved.set(key, []);
    reserved.get(key).push({ start, end });
  }

  let attempts = 0;
  while (bookings.length < BOOKING_TARGET && attempts < BOOKING_MAX_ATTEMPTS) {
    attempts++;

    const parking = pick(parkingsForBooking);
    const user = pick(customers);

    // start within last 90 days
    const start = faker.date.recent({ days: 90 });

    const duration = roundToStep(
      randInt(parking.min_booking_minutes, parking.max_booking_minutes),
      15
    );
    const end = new Date(start.getTime() + duration * 60 * 1000);

    // status distribution (more confirmed than others)
    const status = pick([
      "CONFIRMED", "CONFIRMED", "CONFIRMED",
      "PENDING",
      "CANCELLED",
      "EXPIRED",
    ]);

    // For PENDING/CONFIRMED: ensure no overlap for same user+parking
    if ((status === "PENDING" || status === "CONFIRMED") && overlapsExisting(user.email, parking.name, start, end)) {
      continue;
    }

    if (status === "PENDING" || status === "CONFIRMED") {
      reserveRange(user.email, parking.name, start, end);
    }

    const tiers = pricingIndex.get(parking.name) || [];
    const total_amount_pence = tiers.length ? priceForMinutes(tiers, duration) : randInt(300, 5000);

    const stripe_payment_intent_id =
      status === "CONFIRMED" ? fakeStripe("pi") :
      status === "PENDING" ? null :
      fakeStripe("pi");

    bookings.push({
      user_email: user.email,
      parking_ref_name: parking.name,
      start_at: start,
      end_at: end,
      status,
      total_amount_pence,
      currency: "GBP",
      stripe_payment_intent_id,
    });

    // payments aligned to booking status
    let payStatus;
    if (status === "CONFIRMED") payStatus = "SUCCEEDED";
    else if (status === "PENDING") payStatus = "REQUIRES_PAYMENT";
    else if (status === "EXPIRED") payStatus = pick(["FAILED", "REQUIRES_PAYMENT"]);
    else payStatus = pick(["REFUNDED", "FAILED"]); // CANCELLED

    payments.push({
      provider: "stripe",
      provider_payment_id: fakeStripe("ch"),
      status: payStatus,
      amount_pence: total_amount_pence,
      raw: { seeded: true, booking_status: status },
    });
  }

  return { users, parkings, ownerRegistrations, pricingTiers, blackouts, bookings, payments, attempts };
}

// -------------------- main --------------------
async function run() {
  const seed = buildSeedData();

  console.log("Seed plan:", {
    users: seed.users.length,
    parkings: seed.parkings.length,
    owner_registrations: seed.ownerRegistrations.length,
    pricing_tiers: seed.pricingTiers.length,
    blackouts: seed.blackouts.length,
    bookings: seed.bookings.length,
    payments: seed.payments.length,
    booking_generation_attempts: seed.attempts,
    DRY_RUN,
    TRUNCATE,
    SEED,
  });

  console.log("Sample user:", seed.users[0]);
  console.log("Sample parking:", seed.parkings[0]);
  console.log("Sample booking:", seed.bookings[0]);

  if (DRY_RUN) {
    console.log("DRY_RUN=true -> not writing to DB.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (TRUNCATE) await truncateAll(client);

    const { userIdByEmail, adminIds } = await insertUsers(client, seed.users);
    const { parkingIdByName } = await insertParkings(client, seed.parkings, userIdByEmail);

    await insertPricingTiers(client, seed.pricingTiers, parkingIdByName);
    await insertBlackouts(client, seed.blackouts, parkingIdByName);
    await insertOwnerRegistrations(client, seed.ownerRegistrations, userIdByEmail, parkingIdByName, adminIds);

    // Only insert bookings that can be mapped to ids
    const filteredBookings = seed.bookings.filter(
      (b) => userIdByEmail.get(b.user_email) && parkingIdByName.get(b.parking_ref_name)
    );
    const filteredPayments = seed.payments.slice(0, filteredBookings.length);

    await insertBookingsAndPayments(client, filteredBookings, filteredPayments, userIdByEmail, parkingIdByName);

    await client.query("COMMIT");
    console.log("✅ Seed completed");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", e?.message || e);
    throw e;
  } finally {
    client.release();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
