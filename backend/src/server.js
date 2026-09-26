import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configure, checkPNRStatus } from "railkit";
import { z } from "zod";
import { connectDB, isDbConnected } from "./db.js";
import { Party, Ticket, Payment, PnrRecord, Settings, User, QrScan } from "./models/index.js";
import {
  generateGoogleAuthUrl,
  handleGoogleCallback,
  getGoogleStatus,
  uploadJpgImage
} from "./services/index.js";
import { parseQrData } from "./utils/qrParser.js";
import { encrypt, decrypt, maskSecret } from "./utils/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../../frontend/dist");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").trim().split(/\s+/)[0];
const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// In-memory fallback if MongoDB connection is pending or offline
const memory = {
  pnrRecords: [],
  tickets: [],
  parties: [],
  payments: [],
  qrScans: []
};

const authTokens = new Map();

if (process.env.RAILKIT_API_KEY) configure(process.env.RAILKIT_API_KEY);

app.set("trust proxy", 1);
app.disable("x-powered-by");

// Enhanced HTTP security headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xContentTypeOptions: true,
  xFrameOptions: { action: "sameorigin" }
}));

// Allowed origins whitelist for CORS & CSRF defense
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001"
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".onrender.com") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy violation: origin not allowed"));
  },
  credentials: true
}));

// Request body payload limit (6MB to handle QR images cleanly)
app.use(express.json({ limit: "6mb" }));

// Secure session configuration
app.use(session({
  name: "__gdp_sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// CSRF Defense-in-depth middleware for state-changing HTTP methods
function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Exempt external OAuth callback
  if (req.path === "/api/google/callback") {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith(".onrender.com") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1");
    if (!isAllowed) {
      return res.status(403).json({ message: "CSRF check failed: Origin not permitted." });
    }
  } else if (referer) {
    try {
      const refUrl = new URL(referer);
      const isAllowed =
        allowedOrigins.includes(refUrl.origin) ||
        refUrl.origin.endsWith(".onrender.com") ||
        refUrl.origin.includes("localhost") ||
        refUrl.origin.includes("127.0.0.1");
      if (!isAllowed) {
        return res.status(403).json({ message: "CSRF check failed: Referer not permitted." });
      }
    } catch {
      return res.status(403).json({ message: "CSRF check failed: Malformed Referer." });
    }
  }

  next();
}

app.use("/api", csrfProtection);

// Rate limiters
const generalApiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const pnrLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });

app.use("/api/", generalApiLimiter);

const loginSchema = z.object({ email: z.string().email().max(160), password: z.string().min(1).max(200) });
const pnrSchema = z.object({ pnr: z.string().regex(/^\d{10}$/, "PNR must be exactly 10 digits.") });
const partySchema = z.object({
  customerName: z.string().min(2).max(120),
  whatsapp: z.string().max(20).optional().default(""),
  email: z.string().email().max(160).optional().or(z.literal("")).default(""),
  address: z.string().max(300).optional().default(""),
  city: z.string().max(80).optional().default(""),
  partyType: z.string().max(40).optional().default("Customer"),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  balance: z.coerce.number().finite().optional().default(0)
});
const paymentSchema = z.object({
  partyId: z.string().min(1),
  partyName: z.string().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().finite().positive()
});
const ticketSchema = z.object({
  partyId: z.string().min(1),
  partyName: z.string().min(2).max(120),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pnr: z.string().min(1).max(30),
  amount: z.coerce.number().finite().min(0)
});

function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  if (bearer && authTokens.has(bearer)) {
    const sessionUser = authTokens.get(bearer);
    req.session.userId = sessionUser.userId;
    req.session.userRole = sessionUser.role;
  }
  if (!req.session.userId) return res.status(401).json({ message: "Authentication required." });
  next();
}

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  service: "railway-agent-backend",
  mongoConnected: isDbConnected(),
  railkitConfigured: Boolean(process.env.RAILKIT_API_KEY)
}));

app.get("/api/ping", (_req, res) => res.status(200).send("pong"));

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login details." });
  const email = parsed.data.email.trim().toLowerCase();
  const inputPassword = parsed.data.password;

  let authenticatedUser = null;

  // 1. Authenticate against MongoDB Atlas User collection
  if (isDbConnected()) {
    try {
      const user = await User.findOne({ email }).lean();
      if (user && user.passwordHash) {
        const isMatch = await bcrypt.compare(inputPassword, user.passwordHash);
        if (isMatch) {
          authenticatedUser = {
            id: user.id || "admin-1",
            name: user.name || "Administrator",
            email: user.email,
            role: user.role || "ADMIN"
          };
        }
      }
    } catch (dbErr) {
      console.error("Auth DB error:", dbErr);
    }
  }

  // 2. Fallback to environment variables
  if (!authenticatedUser) {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
    if (email === adminEmail && inputPassword === adminPassword) {
      authenticatedUser = {
        id: "demo-admin",
        name: "Administrator",
        email: adminEmail,
        role: "ADMIN"
      };
    }
  }

  if (!authenticatedUser) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  authTokens.set(token, { userId: authenticatedUser.id, role: authenticatedUser.role, createdAt: Date.now() });
  req.session.userId = authenticatedUser.id;
  req.session.userRole = authenticatedUser.role;

  const sendLogin = () => res.json({
    user: authenticatedUser,
    token
  });
  if (typeof req.session.save === "function") {
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      sendLogin();
    });
  } else {
    sendLogin();
  }
});

app.post("/api/auth/logout", (req, res) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  if (bearer) authTokens.delete(bearer);
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", async (req, res) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  const tokenData = bearer ? authTokens.get(bearer) : null;
  const userId = tokenData?.userId || req.session.userId;

  if (!userId) return res.status(401).json({ message: "Not authenticated." });

  if (isDbConnected()) {
    try {
      const user = await User.findOne({ id: userId }).lean();
      if (user) {
        return res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status
          }
        });
      }
    } catch (e) {
      console.error("Auth me DB error:", e);
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  res.json({ user: { id: userId, name: "Administrator", email: adminEmail, role: "ADMIN", status: "ACTIVE" } });
});

app.get("/api/dashboard/summary", requireAuth, async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (isDbConnected()) {
    try {
      const [partyCount, ticketCount, todayBookings, partiesWithBalance] = await Promise.all([
        Party.countDocuments(),
        Ticket.countDocuments(),
        Ticket.countDocuments({ createdAt: { $gte: todayStart } }),
        Party.find({ balance: { $gt: 0 } }, "balance").lean()
      ]);
      const outstandingTotal = partiesWithBalance.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
      return res.json({
        partyCount,
        ticketCount,
        outstanding: outstandingTotal.toFixed(2),
        todayBookings
      });
    } catch (error) {
      console.error("Dashboard summary DB error:", error);
    }
  }

  const todayBookings = memory.tickets.filter(t => new Date(t.createdAt) >= todayStart).length;
  res.json({ partyCount: memory.parties.length, ticketCount: memory.tickets.length, outstanding: "0.00", todayBookings });
});

app.get("/api/parties", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const parties = await Party.find().sort({ createdAt: -1 }).lean();
      return res.json({ parties });
    } catch (error) {
      console.error("Fetch parties DB error:", error);
    }
  }
  res.json({ parties: memory.parties });
});

app.post("/api/parties", requireAuth, async (req, res) => {
  const parsed = partySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide a valid customer name and party details." });

  const normalizedParty = {
    ...parsed.data,
    whatsapp: parsed.data.whatsapp ? parsed.data.whatsapp.replace(/\D/g, "") : "",
    email: parsed.data.email ? parsed.data.email.trim().toLowerCase() : ""
  };
  const duplicateMessage = "This WhatsApp number or email is already registered.";

  if (isDbConnected()) {
    try {
      const duplicateOr = [];
      if (normalizedParty.whatsapp) duplicateOr.push({ whatsapp: normalizedParty.whatsapp });
      if (normalizedParty.email) duplicateOr.push({ email: normalizedParty.email });
      if (duplicateOr.length) {
        const existing = await Party.findOne({ $or: duplicateOr }).select("id").lean();
        if (existing) return res.status(409).json({ message: duplicateMessage });
      }
    } catch (error) {
      console.error("Check duplicate party DB error:", error);
      return res.status(500).json({ message: "Could not verify duplicate party details." });
    }
  } else {
    const duplicate = memory.parties.find(p =>
      (normalizedParty.whatsapp && p.whatsapp === normalizedParty.whatsapp) ||
      (normalizedParty.email && p.email === normalizedParty.email)
    );
    if (duplicate) return res.status(409).json({ message: duplicateMessage });
  }

  const now = new Date().toISOString();
  const partyData = { id: `PTY-${Date.now()}`, ...normalizedParty, createdAt: now, updatedAt: now };

  if (isDbConnected()) {
    try {
      const doc = await Party.create(partyData);
      return res.status(201).json({ party: doc.toObject() });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ message: duplicateMessage });
      console.error("Save party DB error:", error);
      return res.status(500).json({ message: "Could not create party. Please try again." });
    }
  }

  memory.parties.unshift(partyData);
  res.status(201).json({ party: partyData });
});

app.delete("/api/parties/:id", requireAuth, async (req, res) => {
  if (isDbConnected()) {
    try {
      const party = await Party.findOne({ id: req.params.id }).select("id").lean();
      if (!party) return res.status(404).json({ message: "Party not found." });

      const [ticketCount, pnrCount] = await Promise.all([
        Ticket.countDocuments({ partyId: req.params.id }),
        PnrRecord.countDocuments({ partyId: req.params.id })
      ]);

      if (ticketCount > 0 || pnrCount > 0) {
        return res.status(409).json({
          message: "This party cannot be deleted because transaction or PNR records are linked to it."
        });
      }

      await Party.deleteOne({ id: req.params.id });
      return res.json({ success: true, message: "Party deleted successfully." });
    } catch (error) {
      console.error("Delete party DB error:", error);
      return res.status(500).json({ message: "Could not delete party. Please try again." });
    }
  }

  const index = memory.parties.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Party not found." });

  const hasLinkedRecords =
    memory.tickets.some(t => t.partyId === req.params.id) ||
    false;
  if (hasLinkedRecords) {
    return res.status(409).json({
      message: "This party cannot be deleted because transaction or PNR records are linked to it."
    });
  }

  memory.parties.splice(index, 1);
  res.json({ success: true, message: "Party deleted successfully." });
});

app.get("/api/parties/:id", requireAuth, async (req, res) => {
  if (isDbConnected()) {
    try {
      const party = await Party.findOne({ id: req.params.id }).lean();
      if (party) return res.json({ party });
      return res.status(404).json({ message: "Party not found." });
    } catch (error) {
      console.error("Get party DB error:", error);
    }
  }
  const party = memory.parties.find(item => item.id === req.params.id);
  if (!party) return res.status(404).json({ message: "Party not found." });
  res.json({ party });
});

app.put("/api/parties/:id", requireAuth, async (req, res) => {
  const parsed = partySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid party details." });

  const normalizedParty = {
    ...parsed.data,
    ...(Object.prototype.hasOwnProperty.call(parsed.data, "whatsapp")
      ? { whatsapp: parsed.data.whatsapp ? parsed.data.whatsapp.replace(/\D/g, "") : "" }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(parsed.data, "email")
      ? { email: parsed.data.email ? parsed.data.email.trim().toLowerCase() : "" }
      : {})
  };
  const duplicateMessage = "This WhatsApp number or email is already registered.";

  if (isDbConnected()) {
    try {
      const current = await Party.findOne({ id: req.params.id }).select("id").lean();
      if (!current) return res.status(404).json({ message: "Party not found." });

      const duplicateOr = [];
      if (normalizedParty.whatsapp) duplicateOr.push({ whatsapp: normalizedParty.whatsapp });
      if (normalizedParty.email) duplicateOr.push({ email: normalizedParty.email });
      if (duplicateOr.length) {
        const existing = await Party.findOne({
          $and: [{ id: { $ne: req.params.id } }, { $or: duplicateOr }]
        }).select("id").lean();
        if (existing) return res.status(409).json({ message: duplicateMessage });
      }

      const party = await Party.findOneAndUpdate(
        { id: req.params.id },
        { $set: normalizedParty },
        { returnDocument: "after" }
      ).lean();
      if (party) return res.json({ party });
      return res.status(404).json({ message: "Party not found." });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ message: duplicateMessage });
      console.error("Update party DB error:", error);
      return res.status(500).json({ message: "Could not update party. Please try again." });
    }
  }

  const index = memory.parties.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Party not found." });

  const duplicate = memory.parties.find((item, i) =>
    i !== index &&
    ((normalizedParty.whatsapp && item.whatsapp === normalizedParty.whatsapp) ||
      (normalizedParty.email && item.email === normalizedParty.email))
  );
  if (duplicate) return res.status(409).json({ message: duplicateMessage });

  memory.parties[index] = { ...memory.parties[index], ...normalizedParty, updatedAt: new Date().toISOString() };
  res.json({ party: memory.parties[index] });
});

app.get("/api/reports/balance-payments", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const parties = await Party.find({ balance: { $gt: 0 } })
        .sort({ balance: -1, customerName: 1 })
        .lean();
      const mapped = parties.map(p => ({
        id: p.id,
        customerName: p.customerName,
        whatsapp: p.whatsapp,
        email: p.email,
        city: p.city,
        partyType: p.partyType,
        status: p.status,
        balance: Number(p.balance || 0)
      }));
      const total = mapped.reduce((sum, p) => sum + p.balance, 0);
      return res.json({ parties: mapped, total, count: mapped.length });
    } catch (error) {
      console.error("Balance report DB error:", error);
    }
  }

  const parties = memory.parties
    .filter(p => Number(p.balance || 0) > 0)
    .map(p => ({
      id: p.id,
      customerName: p.customerName,
      whatsapp: p.whatsapp,
      email: p.email,
      city: p.city,
      partyType: p.partyType,
      status: p.status,
      balance: Number(p.balance || 0)
    }))
    .sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));
  const total = parties.reduce((sum, p) => sum + p.balance, 0);
  res.json({ parties, total, count: parties.length });
});

app.get("/api/reports/party-ledger/:partyId", requireAuth, async (req, res) => {
  let party = null;
  let tickets = [];
  let payments = [];

  if (isDbConnected()) {
    try {
      party = await Party.findOne({ id: req.params.partyId }).lean();
      if (party) {
        [tickets, payments] = await Promise.all([
          Ticket.find({ partyId: party.id }).lean(),
          Payment.find({ partyId: party.id }).lean()
        ]);
      }
    } catch (error) {
      console.error("Party ledger DB error:", error);
    }
  }

  if (!party) {
    party = memory.parties.find(p => p.id === req.params.partyId);
    if (!party) return res.status(404).json({ message: "Party not found." });
    tickets = memory.tickets.filter(t => t.partyId === party.id);
    payments = memory.payments.filter(p => p.partyId === party.id);
  }

  const entries = [
    ...tickets.map(t => ({ id: t.id, date: t.bookingDate, description: "Ticket Booking", reference: t.pnr, dr: Number(t.amount || 0), cr: 0 })),
    ...payments.map(p => ({ id: p.id, date: p.date, description: "Payment Received", reference: p.id, dr: 0, cr: Number(p.amount || 0) }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  let balance = 0;
  const ledger = entries.map((e, i) => {
    balance += e.dr - e.cr;
    return { ...e, sr: i + 1, balance };
  });

  res.json({
    party: { id: party.id, customerName: party.customerName, whatsapp: party.whatsapp, email: party.email, city: party.city },
    ledger,
    totalDr: ledger.reduce((n, e) => n + e.dr, 0),
    totalCr: ledger.reduce((n, e) => n + e.cr, 0),
    balance
  });
});

app.get("/api/payments/received", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const payments = await Payment.find().sort({ createdAt: -1 }).lean();
      return res.json({ payments });
    } catch (error) {
      console.error("Fetch payments DB error:", error);
    }
  }
  res.json({ payments: memory.payments });
});

app.post("/api/payments/received", requireAuth, async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide valid payment details." });

  let party = null;
  if (isDbConnected()) {
    try {
      party = await Party.findOne({ id: parsed.data.partyId });
    } catch (error) {
      console.error("Find party for payment DB error:", error);
    }
  }
  if (!party) party = memory.parties.find(p => p.id === parsed.data.partyId);
  if (!party) return res.status(404).json({ message: "Selected party was not found." });

  const now = new Date().toISOString();
  const paymentData = {
    id: `PAY-${Date.now()}`,
    partyId: party.id,
    partyName: party.customerName,
    date: parsed.data.date,
    amount: parsed.data.amount,
    createdAt: now
  };

  if (isDbConnected()) {
    try {
      const doc = await Payment.create(paymentData);
      await Party.findOneAndUpdate({ id: party.id }, { $inc: { balance: -parsed.data.amount } });
      return res.status(201).json({ payment: doc.toObject() });
    } catch (error) {
      console.error("Save payment DB error:", error);
    }
  }

  party.balance = (party.balance || 0) - parsed.data.amount;
  memory.payments.unshift(paymentData);
  res.status(201).json({ payment: paymentData });
});

app.get("/api/tickets", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
      return res.json({ tickets });
    } catch (error) {
      console.error("Fetch tickets DB error:", error);
    }
  }
  res.json({ tickets: memory.tickets });
});

app.post("/api/tickets", requireAuth, async (req, res) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide valid booking details." });

  let party = null;
  if (isDbConnected()) {
    try {
      party = await Party.findOne({ id: parsed.data.partyId });
    } catch (error) {
      console.error("Find party for ticket DB error:", error);
    }
  }
  if (!party) party = memory.parties.find(item => item.id === parsed.data.partyId);
  if (!party) return res.status(404).json({ message: "Selected party was not found." });

  const now = new Date().toISOString();
  const ticketData = {
    id: `TKT-${Date.now()}`,
    partyId: party.id,
    partyName: party.customerName,
    bookingDate: parsed.data.bookingDate,
    pnr: parsed.data.pnr,
    amount: parsed.data.amount,
    createdAt: now,
    updatedAt: now,
    status: "BOOKED"
  };

  if (isDbConnected()) {
    try {
      const doc = await Ticket.create(ticketData);
      await Party.findOneAndUpdate({ id: party.id }, { $inc: { balance: parsed.data.amount } });
      return res.status(201).json({ ticket: doc.toObject() });
    } catch (error) {
      console.error("Save ticket DB error:", error);
    }
  }

  party.balance = (party.balance || 0) + parsed.data.amount;
  memory.tickets.unshift(ticketData);
  res.status(201).json({ ticket: ticketData });
});

app.post("/api/pnr/fetch", requireAuth, pnrLimiter, async (req, res) => {
  const parsed = pnrSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid 10-digit PNR." });
  if (!process.env.RAILKIT_API_KEY) {
    return res.status(503).json({ message: "RailKit API key is not configured. Add RAILKIT_API_KEY to enable PNR fetching." });
  }

  try {
    const result = await checkPNRStatus(parsed.data.pnr);
    if (!result?.success || !result?.data) {
      return res.status(502).json({ message: result?.error || "PNR details could not be retrieved." });
    }
    const d = result.data;
    const pnrData = {
      pnr: String(d.pnr || parsed.data.pnr),
      trainNumber: d.train?.number || null,
      trainName: d.train?.name || null,
      train: d.train || null,
      journey: d.journey || null,
      booking: d.booking || null,
      chart: d.chart || null,
      journeyDateText: d.journey?.dateOfJourney || null,
      sourceCode: d.journey?.source?.code || null,
      sourceName: d.journey?.source?.name || null,
      destinationCode: d.journey?.destination?.code || null,
      destinationName: d.journey?.destination?.name || null,
      boardingCode: d.journey?.boardingPoint?.code || null,
      boardingName: d.journey?.boardingPoint?.name || null,
      travelClass: d.journey?.class || null,
      quota: d.journey?.quota || null,
      chartStatus: d.chart?.status || null,
      fare: Number(d.booking?.fare || 0),
      passengerCount: Array.isArray(d.passengers) ? d.passengers.length : 0,
      passengers: Array.isArray(d.passengers) ? d.passengers : [],
      rawData: d,
      fetchedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      try {
        const saved = await PnrRecord.findOneAndUpdate(
          { pnr: pnrData.pnr },
          { $set: pnrData, $setOnInsert: { id: `pnr-${Date.now()}` } },
          { upsert: true, returnDocument: "after" }
        ).lean();
        return res.json({ message: "PNR details were fetched and saved in MongoDB.", record: saved });
      } catch (dbErr) {
        console.error("Save PNR to DB error:", dbErr);
      }
    }

    const existingIndex = memory.pnrRecords.findIndex(item => item.pnr === pnrData.pnr);
    const saved = { id: existingIndex >= 0 ? memory.pnrRecords[existingIndex].id : `pnr-${Date.now()}`, ...pnrData };
    if (existingIndex >= 0) memory.pnrRecords[existingIndex] = saved;
    else memory.pnrRecords.unshift(saved);

    res.json({ message: "PNR details were fetched and saved in temporary storage.", record: saved });
  } catch (error) {
    console.error("RailKit PNR error:", error);
    res.status(502).json({ message: error?.message || "PNR could not be fetched from RailKit." });
  }
});

app.get("/api/pnr/recent", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const records = await PnrRecord.find().sort({ fetchedAt: -1 }).limit(20).lean();
      return res.json({ records });
    } catch (error) {
      console.error("Fetch recent PNR DB error:", error);
    }
  }
  res.json({ records: memory.pnrRecords.slice(0, 20) });
});

// Sanitizer for Settings: strictly prevents leaking tokens or raw passwords to client
function sanitizeSettings(settings) {
  if (!settings) return {};
  const s = { ...settings };
  delete s.googleRefreshToken;
  s.hasSmtpPassword = Boolean(s.smtpPassword);
  s.smtpPassword = s.smtpPassword ? "••••••••" : "";
  s.hasWhatsappToken = Boolean(s.whatsappToken);
  s.whatsappToken = s.whatsappToken ? "••••••••" : "";
  return s;
}

// Settings API
app.get("/api/settings", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      let settings = await Settings.findOne({ key: "global" }).lean();
      if (!settings) {
        settings = (await Settings.create({ key: "global" })).toObject();
      }
      return res.json({ settings: sanitizeSettings(settings) });
    } catch (error) {
      console.error("Fetch settings DB error:", error);
    }
  }
  res.json({ settings: sanitizeSettings({}) });
});

app.put("/api/settings", requireAuth, async (req, res) => {
  const payload = { ...req.body };
  delete payload.googleRefreshToken; // Never allow client to manually modify OAuth token

  // Encrypt secrets at rest with AES-256-GCM
  if (payload.smtpPassword && payload.smtpPassword !== "••••••••") {
    payload.smtpPassword = encrypt(payload.smtpPassword);
  } else {
    delete payload.smtpPassword; // Retain existing encrypted password
  }

  if (payload.whatsappToken && payload.whatsappToken !== "••••••••") {
    payload.whatsappToken = encrypt(payload.whatsappToken);
  } else {
    delete payload.whatsappToken; // Retain existing encrypted token
  }

  if (isDbConnected()) {
    try {
      const updated = await Settings.findOneAndUpdate(
        { key: "global" },
        { $set: payload },
        { upsert: true, returnDocument: "after" }
      ).lean();
      return res.json({ settings: sanitizeSettings(updated), message: "Settings saved securely to database." });
    } catch (error) {
      console.error("Save settings DB error:", error);
    }
  }
  res.json({ settings: sanitizeSettings(payload), message: "Settings saved temporarily." });
});

// User Password Update API
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters long.")
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input." });
  }

  const userId = req.session.userId;
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database offline. Password cannot be changed in temporary mode." });
  }

  try {
    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Failed to update password." });
  }
});

// Google Drive & Gmail API Integration
app.get("/api/google/status", requireAuth, async (_req, res) => {
  try {
    const status = await getGoogleStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/google/auth-url", requireAuth, (_req, res) => {
  try {
    const url = generateGoogleAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code missing.");
  }
  try {
    await handleGoogleCallback(code);
    res.redirect("/settings?google=connected");
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.status(500).send("Failed to authorize Google account: " + err.message);
  }
});

app.post("/api/google/disconnect", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      await Settings.findOneAndUpdate(
        { key: "global" },
        {
          $set: {
            googleConnected: false,
            googleRefreshToken: "",
            googleConnectedAt: null
          }
        }
      );
    } catch (e) {
      console.error("Disconnect Google error:", e);
    }
  }
  res.json({ ok: true, message: "Google account disconnected." });
});

// QR Code Scanner & Storage API with payload limits and MIME sanitization
app.post("/api/qr/save", requireAuth, uploadLimiter, async (req, res) => {
  const { rawText, fileName, imageBase64 } = req.body || {};
  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ message: "No QR code text provided." });
  }
  if (rawText.length > 5000) {
    return res.status(400).json({ message: "QR payload exceeds maximum length limit." });
  }

  // Prevent path traversal on filename
  const safeFileName = path.basename(fileName || `QR-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const { qrType, parsedData, pnr } = parseQrData(rawText);
  const scanId = `QR-${Date.now()}`;
  let driveFileId = "";
  let driveViewLink = "";

  if (imageBase64 && typeof imageBase64 === "string") {
    // Validate payload size (max 7MB base64 ~ 5MB decoded)
    if (imageBase64.length > 7 * 1024 * 1024) {
      return res.status(413).json({ message: "Image payload exceeds maximum allowed size (5MB)." });
    }
    // Strict MIME header check
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(imageBase64)) {
      return res.status(400).json({ message: "Invalid image format. Only JPEG, PNG, and WebP are accepted." });
    }

    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const driveUpload = await uploadJpgImage({
        fileName: safeFileName.endsWith(".jpg") || safeFileName.endsWith(".jpeg") ? safeFileName : `${safeFileName}.jpg`,
        fileBuffer: buffer,
        mimeType: "image/jpeg"
      });
      if (driveUpload) {
        driveFileId = driveUpload.id || "";
        driveViewLink = driveUpload.webViewLink || driveUpload.webContentLink || "";
      }
    } catch (driveErr) {
      console.warn("QR image Google Drive upload skipped/failed:", driveErr.message);
    }
  }

  const record = {
    id: scanId,
    rawText,
    qrType,
    parsedData,
    pnr,
    fileName: safeFileName,
    driveFileId,
    driveViewLink,
    scannedAt: new Date().toISOString()
  };

  if (isDbConnected()) {
    try {
      const doc = await QrScan.create(record);
      return res.status(201).json({ success: true, scan: doc.toObject() });
    } catch (dbErr) {
      console.error("Save QR scan to DB error:", dbErr);
    }
  }

  memory.qrScans.unshift(record);
  res.status(201).json({ success: true, scan: record });
});

app.get("/api/qr/scans", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      const scans = await QrScan.find().sort({ scannedAt: -1 }).limit(50).lean();
      return res.json({ scans });
    } catch (err) {
      console.error("Get QR scans DB error:", err);
    }
  }
  res.json({ scans: memory.qrScans });
});

app.delete("/api/qr/scans/:id", requireAuth, async (req, res) => {
  if (isDbConnected()) {
    try {
      await QrScan.deleteOne({ id: req.params.id });
      return res.json({ success: true, message: "Scan record deleted." });
    } catch (err) {
      console.error("Delete QR scan error:", err);
    }
  }
  const idx = memory.qrScans.findIndex(s => s.id === req.params.id);
  if (idx >= 0) memory.qrScans.splice(idx, 1);
  res.json({ success: true, message: "Scan record deleted." });
});

// Serve static frontend build assets
app.use(express.static(distPath));

// Fallback all non-API GET requests to frontend index.html for Single Page App
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next();
    });
  }
  next();
});

// Hardened error handler: never leak internal stack traces to the client
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.message || err);
  if (err?.message?.includes("CORS")) {
    return res.status(403).json({ message: "Access forbidden by security policy." });
  }
  res.status(err?.status || 500).json({ message: "An unexpected error occurred. Please try again." });
});

async function ensureAdminUser() {
  if (!isDbConnected()) return;
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await User.create({
        id: "admin-1",
        name: "Administrator",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE"
      });
      console.log(`👤 Seeded admin user (${adminEmail}) in MongoDB Atlas.`);
    }
  } catch (err) {
    console.error("Ensure admin user error:", err.message);
  }
}

// Connect to MongoDB and start server
connectDB().finally(async () => {
  await ensureAdminUser();
  app.listen(PORT, () => {
    console.log(`🚀 Railway Agent backend running on port ${PORT}`);
    console.log(`📦 MongoDB Status: ${isDbConnected() ? "Connected to Atlas" : "Disconnected (check network access / IP whitelist)"}`);
  });
});
