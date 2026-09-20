import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 12) {
  throw new Error("ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) are required.");
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  update: { passwordHash, role: "ADMIN", status: "ACTIVE", name: "Administrator" },
  create: {
    name: "Administrator",
    email: email.toLowerCase(),
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE"
  }
});

console.log("Administrator account created/updated.");
await prisma.$disconnect();
