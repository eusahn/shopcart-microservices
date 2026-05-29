import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_MAX_CONNECTIONS,
});

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id           TEXT PRIMARY KEY,                       -- Keycloak subject
      email        TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      phone        TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      line1       TEXT NOT NULL,
      line2       TEXT NOT NULL DEFAULT '',
      city        TEXT NOT NULL,
      region      TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL,
      country     TEXT NOT NULL,
      is_default  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);
  `);
}
