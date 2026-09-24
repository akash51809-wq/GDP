import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas.");

  const email = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "AdminPassword123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        id: "admin-1",
        name: "Administrator",
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE"
      }
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Administrator account ready in MongoDB Atlas:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Status:   ACTIVE (Password configured via environment)`);
  console.log(`   User ID:  ${admin.id}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
