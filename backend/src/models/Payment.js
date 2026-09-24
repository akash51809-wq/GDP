import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    partyId: { type: String, required: true, index: true },
    partyName: { type: String, required: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
