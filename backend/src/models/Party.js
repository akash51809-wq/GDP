import mongoose from "mongoose";

const partySchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    partyType: { type: String, default: "Customer" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    balance: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Party = mongoose.models.Party || mongoose.model("Party", partySchema);
