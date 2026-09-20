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
  parties: []
};

if (process.env.RAILKIT_API_KEY) {
  configure(process.env.RAILKIT_API_KEY);
}

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const pnrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(200)
});

const pnrSchema = z.object({
  pnr: z.string().regex(/^\d{10}$/, "PNR must be exactly 10 digits.")
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required." });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "railway-agent-backend",
    railkitConfigured: Boolean(process.env.RAILKIT_API_KEY)
  });
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid login details." });
  }

  const email = parsed.data.email.toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminEmail || !adminPassword || email !== adminEmail || parsed.data.password !== adminPassword) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  req.session.userId = "demo-admin";
  req.session.userRole = "ADMIN";

  res.json({
    user: {
      id: "demo-admin",
      name: "Administrator",
      email: adminEmail,
      role: "ADMIN"
    }
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (req.session.userId !== "demo-admin" || !adminEmail) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  res.json({
    user: {
      id: "demo-admin",
      name: "Administrator",
      email: adminEmail,
      role: "ADMIN",
      status: "ACTIVE"
    }
  });
});

app.get("/api/dashboard/summary", requireAuth, (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayBookings = memory.tickets.filter(
    (ticket) => new Date(ticket.createdAt) >= todayStart
  ).length;

  res.json({
    partyCount: memory.parties.length,
    ticketCount: memory.tickets.length,
    outstanding: "0.00",
    todayBookings
  });
});

app.post("/api/pnr/fetch", requireAuth, pnrLimiter, async (req, res) => {
  const parsed = pnrSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "10 अंकों का सही PNR डालें।" });
  }

  if (!process.env.RAILKIT_API_KEY) {
    return res.status(503).json({
      message: "RailKit API key configured नहीं है। अभी PNR fetch के लिए RAILKIT_API_KEY डालें।"
    });
  }

  try {
    const result = await checkPNRStatus(parsed.data.pnr);

    if (!result?.success || !result?.data) {
      return res.status(502).json({
        message: result?.error || "PNR details प्राप्त नहीं हो सकीं।"
      });
    }

    const d = result.data;

    const pnrData = {
      pnr: String(d.pnr || parsed.data.pnr),
      trainNumber: d.train?.number || null,
      trainName: d.train?.name || null,
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

    const existingIndex = memory.pnrRecords.findIndex(
      (item) => item.pnr === pnrData.pnr
    );

    const saved = {
      id: existingIndex >= 0
        ? memory.pnrRecords[existingIndex].id
        : `pnr-${Date.now()}`,
      ...pnrData
    };

    if (existingIndex >= 0) {
      memory.pnrRecords[existingIndex] = saved;
    } else {
      memory.pnrRecords.unshift(saved);
    }

    res.json({
      message: "PNR details fetch होकर temporary testing storage में save हो गईं।",
      record: saved
    });
  } catch (error) {
    console.error("RailKit PNR error:", error);
    res.status(502).json({
      message: error?.message || "RailKit से PNR fetch नहीं हो सका।"
    });
  }
});

app.get("/api/pnr/recent", requireAuth, (_req, res) => {
  res.json({ records: memory.pnrRecords.slice(0, 20) });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log("Railway Agent backend running on port " + PORT);
});
