import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { startScheduler } from "./pipeline/scheduler";

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB();
  await connectRedis();

  // Start the RSS pipeline scheduler (every 6 hours)
  startScheduler();

  app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
