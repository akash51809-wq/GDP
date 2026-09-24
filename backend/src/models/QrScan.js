import mongoose from "mongoose";

const qrScanSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true, index: true },
    rawText: { type: String, required: true },
    qrType: {
      type: String,
      enum: ["RAILWAY_TICKET", "UPI_PAYMENT", "URL", "JSON", "TEXT"],
      default: "TEXT"
    },
    parsedData: { type: mongoose.Schema.Types.Mixed, default: {} },
    pnr: { type: String, default: null, index: true },
    fileName: { type: String, default: "" },
    driveFileId: { type: String, default: "" },
    driveViewLink: { type: String, default: "" },
    scannedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const QrScan = mongoose.models.QrScan || mongoose.model("QrScan", qrScanSchema);
