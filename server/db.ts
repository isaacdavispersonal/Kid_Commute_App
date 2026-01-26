// Reference: PostgreSQL database blueprint
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { logger } from "./logger";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Connection pool configuration optimized for Neon serverless
// Neon recommends keeping pool size small for serverless (default pooler limit is typically 100)
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "10000", 10),
};

export const pool = new Pool(poolConfig);

// Connection pool error monitoring
pool.on("error", (err) => {
  logger.error("[db] Pool error - connection lost", {
    message: err.message,
    code: (err as any).code,
    stack: err.stack,
  });
});

pool.on("connect", () => {
  logger.debug("[db] New client connected to pool");
});

pool.on("remove", () => {
  logger.debug("[db] Client removed from pool");
});

// Log pool configuration on startup
logger.info("[db] Connection pool initialized", {
  max: poolConfig.max,
  idleTimeoutMs: poolConfig.idleTimeoutMillis,
  connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
});

export const db = drizzle({ client: pool, schema });

// Health check function for monitoring
export async function checkDbHealth(): Promise<{ healthy: boolean; poolStats: { total: number; idle: number; waiting: number } }> {
  try {
    const result = await pool.query("SELECT 1 as health");
    return {
      healthy: result.rows.length > 0,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch (err) {
    logger.error("[db] Health check failed", { error: (err as Error).message });
    return {
      healthy: false,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  }
}
