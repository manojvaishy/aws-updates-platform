import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { pingRedis } from "./config/redis";
import { getDB } from "./config/db";
import authRoutes from "./routes/auth";
import updatesRoutes from "./routes/updates";
import searchRoutes from "./routes/search";
import userStateRoutes from "./routes/userState";
import analyticsRoutes from "./routes/analytics";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://aws-updates-platform-y1dr.vercel.app",
    /\.vercel\.app$/,
  ],
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Health check
app.get("/health", async (_req, res) => {
  const [redisOk, dbOk] = await Promise.all([
    pingRedis().catch(() => false),
    getDB().query("SELECT 1").then(() => true).catch(() => false),
  ]);
  const status = redisOk && dbOk ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: { postgres: dbOk, redis: redisOk },
  });
});

// Manual pipeline trigger (dev/admin use only)
app.post("/admin/pipeline/run", async (_req, res, next) => {
  try {
    const { runPipeline } = await import("./pipeline/scheduler");
    runPipeline(); // fire-and-forget
    res.json({ message: "Pipeline triggered" });
  } catch (err) {
    next(err);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/updates", updatesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/user", userStateRoutes);
app.use("/api/analytics", analyticsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
