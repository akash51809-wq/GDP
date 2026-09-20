import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { configure, checkPNRStatus } from "railkit";

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PgStore = connectPgSimple(session);

if (process.env.RAILKIT_API_KEY) {
  configure(process.env.RAILKIT_API_KEY);
}

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.use(session({
  store: new PgStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
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
  pnr: z.string().regex(/^\d{10}$/, "PNR must be exactly 10 digits."),
  partyId: z.string().cuid().optional()
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ message: "Authentication required." });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "railway-agent-backend", railkitConfigured: Boolean(process.env.RAILKIT_API_KEY) });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login details." });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  await prisma.auditLog.create({
    data: { userId: user.id, action: "LOGIN", entity: "AUTH" }
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const userId = req.session.userId;
  await prisma.auditLog.create({
    data: { userId, action: "LOGOUT", entity: "AUTH" }
  });
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated." });
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  if (!user || user.status !== "ACTIVE") return res.status(401).json({ message: "Not authenticated." });
  res.json({ user });
});

app.get("/api/dashboard/summary", requireAuth, async (_req, res) => {
  const [partyCount, ticketCount, todayBookings] = await Promise.all([
    prisma.party.count(),
    prisma.ticket.count(),
    prisma.ticket.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);

  res.json({
    partyCount,
    ticketCount,
    outstanding: "0.00",
    todayBookings
  });
});

app.post("/api/pnr/fetch", requireAuth, pnrLimiter, async (req, res) => {
  const parsed = pnrSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "10 अंकों का सही PNR डालें।" });

  if (!process.env.RAILKIT_API_KEY) {
    return res.status(503).json({ message: "RailKit API key configured नहीं है। .env में RAILKIT_API_KEY डालें।" });
  }

  try {
    const result = await checkPNRStatus(parsed.data.pnr);
    if (!result?.success || !result?.data) {
      return res.status(502).json({ message: result?.error || "PNR details प्राप्त नहीं हो सकीं।" });
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
      ...(parsed.data.partyId ? { party: { connect: { id: parsed.data.partyId } } } : {})
    };

    const saved = await prisma.pnrRecord.upsert({
      where: { pnr: pnrData.pnr },
      update: pnrData,
      create: pnrData
    });

    await prisma.auditLog.create({
      data: {
        userId: req.session.userId,
        action: "PNR_FETCH_AND_SAVE",
        entity: "PNR",
        entityId: saved.id,
        metadata: { pnr: saved.pnr, passengerCount: saved.passengerCount }
      }
    });

    res.json({
      message: "PNR details fetch होकर database में save हो गईं।",
      record: {
        id: saved.id,
        pnr: saved.pnr,
        trainNumber: saved.trainNumber,
        trainName: saved.trainName,
        journeyDateText: saved.journeyDateText,
        sourceCode: saved.sourceCode,
        sourceName: saved.sourceName,
        destinationCode: saved.destinationCode,
        destinationName: saved.destinationName,
        boardingCode: saved.boardingCode,
        boardingName: saved.boardingName,
        travelClass: saved.travelClass,
        quota: saved.quota,
        chartStatus: saved.chartStatus,
        fare: saved.fare,
        passengerCount: saved.passengerCount,
        passengers: saved.passengers,
        fetchedAt: saved.fetchedAt
      }
    });
  } catch (error) {
    console.error("RailKit PNR error:", error);
    res.status(502).json({ message: error?.message || "RailKit से PNR fetch नहीं हो सका।" });
  }
});

app.get("/api/pnr/recent", requireAuth, async (_req, res) => {
  const records = await prisma.pnrRecord.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 20,
    select: {
      id: true, pnr: true, trainNumber: true, trainName: true,
      journeyDateText: true, sourceCode: true, sourceName: true,
      destinationCode: true, destinationName: true, travelClass: true,
      quota: true, chartStatus: true, fare: true, passengerCount: true,
      fetchedAt: true
    }
  });
  res.json({ records });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log("Railway Agent backend running on port " + PORT);
});
