import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import { configure, checkPNRStatus } from "railkit";
import { z } from "zod";
import { connectDB, isDbConnected } from "./db.js";
import { Party, Ticket, Payment, PnrRecord, Settings, User } from "./models/index.js";

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
  payments: []
};

const authTokens = new Map();

if (process.env.RAILKIT_API_KEY) configure(process.env.RAILKIT_API_KEY);

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
const pnrLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });

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
    req.session.userId = "demo-admin";
    req.session.userRole = "ADMIN";
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

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login details." });
  const email = parsed.data.email.toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";

  if (!adminEmail || !adminPassword || email !== adminEmail || parsed.data.password !== adminPassword) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  authTokens.set(token, { userId: "demo-admin", role: "ADMIN", createdAt: Date.now() });
  req.session.userId = "demo-admin";
  req.session.userRole = "ADMIN";

  const sendLogin = () => res.json({
    user: { id: "demo-admin", name: "Administrator", email: adminEmail, role: "ADMIN" },
    token
  });
  if (typeof req.session.save === "function") req.session.save(() => sendLogin());
  else sendLogin();
});

app.post("/api/auth/logout", (req, res) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  if (bearer) authTokens.delete(bearer);
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  if (bearer && authTokens.has(bearer)) {
    return res.json({ user: { id: "demo-admin", name: "Administrator", email: adminEmail, role: "ADMIN", status: "ACTIVE" } });
  }
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated." });
  if (req.session.userId !== "demo-admin") return res.status(401).json({ message: "Not authenticated." });
  res.json({ user: { id: "demo-admin", name: "Administrator", email: adminEmail, role: "ADMIN", status: "ACTIVE" } });
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

  const now = new Date().toISOString();
  const partyData = { id: `PTY-${Date.now()}`, ...parsed.data, createdAt: now, updatedAt: now };

  if (isDbConnected()) {
    try {
      const doc = await Party.create(partyData);
      return res.status(201).json({ party: doc.toObject() });
    } catch (error) {
      console.error("Save party DB error:", error);
    }
  }

  memory.parties.unshift(partyData);
  res.status(201).json({ party: partyData });
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

  if (isDbConnected()) {
    try {
      const party = await Party.findOneAndUpdate(
        { id: req.params.id },
        { $set: parsed.data },
        { new: true }
      ).lean();
      if (party) return res.json({ party });
      return res.status(404).json({ message: "Party not found." });
    } catch (error) {
      console.error("Update party DB error:", error);
    }
  }

  const index = memory.parties.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Party not found." });
  memory.parties[index] = { ...memory.parties[index], ...parsed.data, updatedAt: new Date().toISOString() };
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
          { upsert: true, new: true }
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

// Settings API
app.get("/api/settings", requireAuth, async (_req, res) => {
  if (isDbConnected()) {
    try {
      let settings = await Settings.findOne({ key: "global" }).lean();
      if (!settings) {
        settings = (await Settings.create({ key: "global" })).toObject();
      }
      return res.json({ settings });
    } catch (error) {
      console.error("Fetch settings DB error:", error);
    }
  }
  res.json({ settings: {} });
});

app.put("/api/settings", requireAuth, async (req, res) => {
  if (isDbConnected()) {
    try {
      const updated = await Settings.findOneAndUpdate(
        { key: "global" },
        { $set: req.body },
        { upsert: true, new: true }
      ).lean();
      return res.json({ settings: updated, message: "Settings saved to database." });
    } catch (error) {
      console.error("Save settings DB error:", error);
    }
  }
  res.json({ settings: req.body, message: "Settings saved temporarily." });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong." });
});

// Connect to MongoDB and start server
connectDB().finally(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Railway Agent backend running on port ${PORT}`);
    console.log(`📦 MongoDB Status: ${isDbConnected() ? "Connected to Atlas" : "Disconnected (check network access / IP whitelist)"}`);
  });
});
