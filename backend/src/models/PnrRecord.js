import mongoose from "mongoose";

const pnrRecordSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    pnr: { type: String, unique: true, required: true, index: true },
    partyId: { type: String, default: null, index: true },
    trainNumber: { type: String, default: null },
    trainName: { type: String, default: null },
    train: { type: mongoose.Schema.Types.Mixed, default: null },
    journey: { type: mongoose.Schema.Types.Mixed, default: null },
    booking: { type: mongoose.Schema.Types.Mixed, default: null },
    chart: { type: mongoose.Schema.Types.Mixed, default: null },
    journeyDateText: { type: String, default: null },
    sourceCode: { type: String, default: null },
    sourceName: { type: String, default: null },
    destinationCode: { type: String, default: null },
    destinationName: { type: String, default: null },
    boardingCode: { type: String, default: null },
    boardingName: { type: String, default: null },
    travelClass: { type: String, default: null },
    quota: { type: String, default: null },
    chartStatus: { type: String, default: null },
    fare: { type: Number, default: 0 },
    passengerCount: { type: Number, default: 0 },
    passengers: { type: Array, default: [] },
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
    fetchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const PnrRecord = mongoose.models.PnrRecord || mongoose.model("PnrRecord", pnrRecordSchema);
