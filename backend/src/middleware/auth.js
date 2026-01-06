const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { pool } = require("../config/db");

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  return token || null;
}

function requireAuth(req, res, next) {
  (async () => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Always load current role + approval from DB (so admin approval takes effect immediately)
    const r = await pool.query(
      `SELECT id, email, role, is_approved
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (r.rowCount === 0) return res.status(401).json({ error: "User no longer exists" });

    req.user = {
      id: r.rows[0].id,
      email: r.rows[0].email,
      role: r.rows[0].role,
      is_approved: r.rows[0].is_approved,
    };

    return next();
  })().catch(() => res.status(401).json({ error: "Unauthorized" }));
}

function requireRole(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, getBearerToken };

