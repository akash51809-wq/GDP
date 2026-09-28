import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

let connected = false;

export async function connectDB() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
    console.log("✅ Successfully connected to PostgreSQL.");
    return true;
  } catch (error) {
    connected = false;
    console.error("❌ PostgreSQL connection error:", error.message);
    return false;
  }
}

export function isDbConnected() {
  return Boolean(process.env.DATABASE_URL) && connected;
}

export async function disconnectDB() {
  await prisma.$disconnect();
  connected = false;
}
