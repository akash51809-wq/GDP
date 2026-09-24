import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "MANAGER", "STAFF", "ACCOUNTS"], default: "STAFF" },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" }
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
