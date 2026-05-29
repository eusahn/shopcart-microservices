import type { ServiceImpl } from "@connectrpc/connect";
import { InventoryService } from "@shopcart/proto/inventory-connect";
import {
  GetStockResponse, ReserveResponse, ReleaseResponse, StockLevel,
} from "@shopcart/proto/inventory";
import { pool } from "./db.js";

export async function reserveLines(
  orderId: string,
  lines: Array<{ productId: string; quantity: number }>,
): Promise<{ ok: boolean; outOfStock: string[] }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const outOfStock: string[] = [];
    for (const l of lines) {
      const r = await client.query<{ available: number }>(
        `SELECT available FROM stock WHERE product_id = $1 FOR UPDATE`,
        [l.productId],
      );
      const avail = r.rows[0]?.available ?? 0;
      if (avail < l.quantity) outOfStock.push(l.productId);
    }
    if (outOfStock.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, outOfStock };
    }
    for (const l of lines) {
      await client.query(
        `UPDATE stock SET available = available - $2, reserved = reserved + $2 WHERE product_id = $1`,
        [l.productId, l.quantity],
      );
      await client.query(
        `INSERT INTO reservations (order_id, product_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [orderId, l.productId, l.quantity],
      );
    }
    await client.query("COMMIT");
    return { ok: true, outOfStock: [] };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function releaseReservation(orderId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM reservations WHERE order_id = $1`,
      [orderId],
    );
    for (const row of r.rows) {
      await client.query(
        `UPDATE stock SET available = available + $2, reserved = reserved - $2 WHERE product_id = $1`,
        [row.product_id, row.quantity],
      );
    }
    await client.query(`DELETE FROM reservations WHERE order_id = $1`, [orderId]);
    await client.query("COMMIT");
    return r.rows.length > 0;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export const inventoryImpl: ServiceImpl<typeof InventoryService> = {
  async getStock(req) {
    if (req.productIds.length === 0) {
      return new GetStockResponse({ levels: [] });
    }
    const { rows } = await pool.query<{ product_id: string; available: number; reserved: number }>(
      `SELECT product_id, available, reserved FROM stock WHERE product_id = ANY($1::text[])`,
      [req.productIds],
    );
    return new GetStockResponse({
      levels: rows.map((r) => new StockLevel({
        productId: r.product_id, available: r.available, reserved: r.reserved,
      })),
    });
  },

  async reserve(req) {
    const result = await reserveLines(req.orderId, req.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })));
    return new ReserveResponse({ ok: result.ok, outOfStockProductIds: result.outOfStock });
  },

  async release(req) {
    const ok = await releaseReservation(req.orderId);
    return new ReleaseResponse({ ok });
  },
};
