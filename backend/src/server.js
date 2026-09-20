import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import { configure, checkPNRStatus } from "railkit";
import { z } from "zod";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").trim().split(/\s+/)[0];
const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

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
  secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax", maxAge: 1000 * 60 * 60 * 8 }
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
  status: z.enum(["ACTIVE","INACTIVE"]).optional().default("ACTIVE"),
  balance: z.coerce.number().finite().optional().default(0)
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

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "railway-agent-backend", railkitConfigured: Boolean(process.env.RAILKIT_API_KEY) }));

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login details." });
  const email = parsed.data.email.toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPassword || email !== adminEmail || parsed.data.password !== adminPassword)
    return res.status(401).json({ message: "Email or password is incorrect." });

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
  if (bearer && authTokens.has(bearer)) {
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    return res.json({ user: { id: "demo-admin", name: "Administrator", email: adminEmail, role: "ADMIN", status: "ACTIVE" } });
  }
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated." });
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (req.session.userId !== "demo-admin" || !adminEmail) return res.status(401).json({ message: "Not authenticated." });
  res.json({ user: { id: "demo-admin", name: "Administrator", email: adminEmail, role: "ADMIN", status: "ACTIVE" } });
});

app.get("/api/dashboard/summary", requireAuth, (_req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayBookings = memory.tickets.filter(t => new Date(t.createdAt) >= todayStart).length;
  res.json({ partyCount: memory.parties.length, ticketCount: memory.tickets.length, outstanding: "0.00", todayBookings });
});

app.get("/api/parties", requireAuth, (_req, res) => res.json({ parties: memory.parties }));
app.post("/api/parties", requireAuth, (req, res) => {
  const parsed = partySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide a valid customer name and party details." });
  const now = new Date().toISOString();
  const party = { id: `PTY-${Date.now()}`, ...parsed.data, createdAt: now, updatedAt: now };
  memory.parties.unshift(party);
  res.status(201).json({ party });
});
app.get("/api/parties/:id", requireAuth, (req, res) => {
  const party = memory.parties.find(item => item.id === req.params.id);
  if (!party) return res.status(404).json({ message: "Party not found." });
  res.json({ party });
});
app.put("/api/parties/:id", requireAuth, (req, res) => {
  const index = memory.parties.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Party not found." });
  const parsed = partySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid party details." });
  memory.parties[index] = { ...memory.parties[index], ...parsed.data, updatedAt: new Date().toISOString() };
  res.json({ party: memory.parties[index] });
});

app.get("/api/reports/balance-payments", requireAuth, (_req, res) => {\n  const parties = memory.parties\n    .filter(p => Number(p.balance || 0) > 0)\n    .map(p => ({ id: p.id, customerName: p.customerName, whatsapp: p.whatsapp, email: p.email, city: p.city, partyType: p.partyType, status: p.status, balance: Number(p.balance || 0) }))\n    .sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));\n  const total = parties.reduce((sum, p) => sum + p.balance, 0);\n  res.json({ parties, total, count: parties.length });\n});\n\napp.get("/api/tickets", requireAuth, (_req, res) => res.json({ tickets: memory.tickets }));
app.post("/api/tickets", requireAuth, (req, res) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide valid booking details." });
  const party = memory.parties.find(item => item.id === parsed.data.partyId);
  if (!party) return res.status(404).json({ message: "Selected party was not found." });
  const now = new Date().toISOString();
  const ticket = {
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
  memory.tickets.unshift(ticket);
  res.status(201).json({ ticket });
});

app.post("/api/pnr/fetch", requireAuth, pnrLimiter, async (req, res) => {
  const parsed = pnrSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid 10-digit PNR." });
  if (!process.env.RAILKIT_API_KEY) return res.status(503).json({ message: "RailKit API key is not configured. Add RAILKIT_API_KEY to enable PNR fetching." });
  try {
    const result = await checkPNRStatus(parsed.data.pnr);
    if (!result?.success || !result?.data) return res.status(502).json({ message: result?.error || "PNR details could not be retrieved." });
    const d = result.data;
    const pnrData = {
      pnr: String(d.pnr || parsed.data.pnr), trainNumber: d.train?.number || null, trainName: d.train?.name || null,
      train: d.train || null, journey: d.journey || null, booking: d.booking || null, chart: d.chart || null,
      journeyDateText: d.journey?.dateOfJourney || null, sourceCode: d.journey?.source?.code || null, sourceName: d.journey?.source?.name || null,
      destinationCode: d.journey?.destination?.code || null, destinationName: d.journey?.destination?.name || null,
      boardingCode: d.journey?.boardingPoint?.code || null, boardingName: d.journey?.boardingPoint?.name || null,
      travelClass: d.journey?.class || null, quota: d.journey?.quota || null, chartStatus: d.chart?.status || null,
      fare: Number(d.booking?.fare || 0), passengerCount: Array.isArray(d.passengers) ? d.passengers.length : 0,
      passengers: Array.isArray(d.passengers) ? d.passengers : [], rawData: d, fetchedAt: new Date().toISOString()
    };
    const existingIndex = memory.pnrRecords.findIndex(item => item.pnr === pnrData.pnr);
    const saved = { id: existingIndex >= 0 ? memory.pnrRecords[existingIndex].id : `pnr-${Date.now()}`, ...pnrData };
    if (existingIndex >= 0) memory.pnrRecords[existingIndex] = saved; else memory.pnrRecords.unshift(saved);
    res.json({ message: "PNR details were fetched and saved in temporary testing storage.", record: saved });
  } catch (error) {
    console.error("RailKit PNR error:", error);
    res.status(502).json({ message: error?.message || "PNR could not be fetched from RailKit." });
  }
});
app.get("/api/pnr/recent", requireAuth, (_req, res) => res.json({ records: memory.pnrRecords.slice(0, 20) }));

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: "Something went wrong." }); });
app.listen(PORT, () => console.log("Railway Agent backend running on port " + PORT));
