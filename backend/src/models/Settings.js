import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true, index: true },
    whatsappUrl: { type: String, default: "" },
    whatsappToken: { type: String, default: "" },
    whatsappSender: { type: String, default: "" },
    whatsappEnabled: { type: Boolean, default: true },
    smtpHost: { type: String, default: "" },
    smtpPort: { type: String, default: "587" },
    smtpUser: { type: String, default: "" },
    smtpPassword: { type: String, default: "" },
    smtpFromName: { type: String, default: "RailDesk" },
    smtpFromEmail: { type: String, default: "" },
    smtpSecure: { type: Boolean, default: true },
    companyName: { type: String, default: "RailDesk" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    dateFormat: { type: String, default: "DD/MM/YYYY" },
    phoneCountryCode: { type: String, default: "+91" },
    lowBalanceAlert: { type: Boolean, default: true },
    autoRefresh: { type: Boolean, default: true },
    googleConnected: { type: Boolean, default: false },
    googleRefreshToken: { type: String, default: "" },
    googleConnectedAt: { type: Date, default: null },
    googleDriveFolderId: { type: String, default: "" }
  },
  { timestamps: true }
);

export const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
