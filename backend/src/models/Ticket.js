import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    partyId: { type: String, required: true, index: true },
    partyName: { type: String, required: true },
    bookingDate: { type: String, required: true },
    pnr: { type: String, required: true },
    amount: { type: Number, default: 0 },
    qrScanId: { type: String, default: "", index: true },
    qrRawText: { type: String, default: "" },
    qrType: { type: String, default: "" },
    qrParsedData: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: "BOOKED" }
  },
  { timestamps: true }
);

export const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
