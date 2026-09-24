import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️  MONGODB_URI is not set. Operating in in-memory fallback mode.");
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Successfully connected to MongoDB Atlas database.");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    if (error.message.includes("whitelist") || error.message.includes("Could not connect to any servers")) {
      console.warn("👉 Tip: Please ensure your IP address is added to the MongoDB Atlas Network Access IP Whitelist (or allow 0.0.0.0/0).");
    }
    return false;
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
