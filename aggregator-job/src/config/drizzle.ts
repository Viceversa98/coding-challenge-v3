import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";
import { env } from "./env";
import { logger } from "../utils/logger";

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 10,
});

pool.on("error", (error: Error) => {
  logger.error("PostgreSQL pool error", { message: error.message });
});

export const db = drizzle(pool, { schema });
