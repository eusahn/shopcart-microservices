import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_MAX_CONNECTIONS,
});

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku         TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
      currency    TEXT NOT NULL DEFAULT 'USD',
      category    TEXT NOT NULL DEFAULT 'misc',
      image_url   TEXT NOT NULL DEFAULT '',
      stock       INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      tsv         tsvector GENERATED ALWAYS AS (
                    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
                  ) STORED
    );
    CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
    CREATE INDEX IF NOT EXISTS products_tsv_idx ON products USING GIN (tsv);
  `);
}

export async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM products`);
  if (Number(rows[0]?.count ?? 0) > 0) return;
  const items = [
    ["TSHIRT-BLK-M", "Classic Black Tee", "100% cotton, regular fit", 1999, "apparel", "https://placehold.co/400?text=Tee", 120],
    ["MUG-CER-W",    "Ceramic Mug",       "12oz white ceramic mug",   1299, "home",    "https://placehold.co/400?text=Mug", 80],
    ["HEADPHN-OE",   "Over-ear Headphones","Bluetooth, 30h battery",   8999, "electronics", "https://placehold.co/400?text=Headphones", 45],
    ["BOOK-DDD",     "Domain-Driven Design","Eric Evans, paperback",   3499, "books",    "https://placehold.co/400?text=Book", 200],
    ["SHOE-RN-10",   "Running Shoes",     "Lightweight road runners",  6499, "apparel", "https://placehold.co/400?text=Shoes", 60],
    ["CANDLE-VAN",   "Vanilla Candle",    "Soy wax, 60h burn",         1499, "home",    "https://placehold.co/400?text=Candle", 150],
    ["NOTEBOOK-A5",  "A5 Notebook",       "Dotted, hardcover",         1199, "office",  "https://placehold.co/400?text=Notebook", 300],
    ["CABLE-USBC",   "USB-C Cable 1m",    "Braided, 100W PD",          899,  "electronics", "https://placehold.co/400?text=Cable", 400],
  ];
  for (const [sku, name, desc, price, cat, img, stock] of items) {
    await pool.query(
      `INSERT INTO products (sku, name, description, price_cents, category, image_url, stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sku) DO NOTHING`,
      [sku, name, desc, price, cat, img, stock],
    );
  }
}
