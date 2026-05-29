import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_MAX_CONNECTIONS,
});

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock (
      product_id TEXT PRIMARY KEY,
      available  INT NOT NULL DEFAULT 0 CHECK (available >= 0),
      reserved   INT NOT NULL DEFAULT 0 CHECK (reserved  >= 0)
    );
    CREATE TABLE IF NOT EXISTS reservations (
      order_id   TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity   INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (order_id, product_id)
    );
  `);
}

// Seed stock for the catalog seed products so the demo flow has inventory.
const SEED: Array<[string, number]> = [
  ["TSHIRT-BLK-M", 120], ["MUG-CER-W", 80], ["HEADPHN-OE", 45],
  ["BOOK-DDD", 200], ["SHOE-RN-10", 60], ["CANDLE-VAN", 150],
  ["NOTEBOOK-A5", 300], ["CABLE-USBC", 400],
];

// In the seed we key by SKU; in production we'd key by product UUID.
// For the demo we accept either — see notes in README.
export async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM stock`);
  if (Number(rows[0]?.count ?? 0) > 0) return;
  for (const [sku, n] of SEED) {
    await pool.query(
      `INSERT INTO stock (product_id, available) VALUES ($1, $2) ON CONFLICT (product_id) DO NOTHING`,
      [sku, n],
    );
  }
}
