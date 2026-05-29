import type { ServiceImpl } from "@connectrpc/connect";
import { OrderService } from "@shopcart/proto/order-connect";
import {
  Order, OrderItem, OrderStatus, ListOrdersResponse,
} from "@shopcart/proto/order";
import { OrderLine } from "@shopcart/proto/events";
import { InvalidArgument, NotFound, FailedPrecondition } from "@shopcart/errors";
import { pool } from "./db.js";
import { cart } from "./clients.js";
import { emitOrderPlaced } from "./events.js";
import { trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";

interface OrderRow {
  id: string;
  user_id: string;
  total_cents: string;
  currency: string;
  status: string;
  shipping_address_id: string;
  created_at: Date;
  updated_at: Date;
}

interface ItemRow {
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: string;
}

const statusMap: Record<string, OrderStatus> = {
  PENDING:    OrderStatus.PENDING,
  RESERVED:   OrderStatus.RESERVED,
  PAID:       OrderStatus.PAID,
  FULFILLED:  OrderStatus.FULFILLED,
  FAILED:     OrderStatus.FAILED,
  CANCELLED:  OrderStatus.CANCELLED,
};

function toOrder(o: OrderRow, items: ItemRow[]): Order {
  return new Order({
    id: o.id,
    userId: o.user_id,
    items: items.map((i) => new OrderItem({
      productId: i.product_id,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: BigInt(i.unit_price_cents),
    })),
    totalCents: BigInt(o.total_cents),
    currency: o.currency,
    status: statusMap[o.status] ?? OrderStatus.UNSPECIFIED,
    shippingAddressId: o.shipping_address_id,
    createdAtUnix: BigInt(Math.floor(o.created_at.getTime() / 1000)),
    updatedAtUnix: BigInt(Math.floor(o.updated_at.getTime() / 1000)),
  });
}

export const orderImpl: ServiceImpl<typeof OrderService> = {
  async placeOrder(req) {
    if (!req.userId) throw new InvalidArgument("user_id required").toConnect();
    const idem = req.idempotencyKey || randomUUID();

    // Idempotency short-circuit: a replayed request must return the prior order
    // BEFORE we look at the cart, since the original placeOrder clears the cart.
    if (req.idempotencyKey) {
      const prior = await pool.query<OrderRow>(
        `SELECT * FROM orders WHERE user_id = $1 AND idempotency_key = $2`,
        [req.userId, idem],
      );
      if (prior.rows[0]) {
        const items = await pool.query<ItemRow>(`SELECT * FROM order_items WHERE order_id = $1`, [prior.rows[0].id]);
        return toOrder(prior.rows[0], items.rows);
      }
    }

    const cartResp = await cart.getCart({ userId: req.userId });
    const c = cartResp.cart;
    if (!c || c.items.length === 0) {
      throw new FailedPrecondition("cart is empty").toConnect();
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const total = c.items.reduce((acc, i) => acc + i.unitPriceCents * BigInt(i.quantity), 0n);
      const ins = await client.query<OrderRow>(
        `INSERT INTO orders (user_id, total_cents, currency, shipping_address_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.userId, total.toString(), c.currency, req.shippingAddressId, idem],
      );
      const order = ins.rows[0]!;
      for (const i of c.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price_cents)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, i.productId, i.sku, i.name, i.quantity, i.unitPriceCents.toString()],
        );
      }
      await client.query("COMMIT");

      const span = trace.getActiveSpan();
      span?.setAttribute("order.id", order.id);
      span?.setAttribute("order.total_cents", Number(total));

      await emitOrderPlaced({
        orderId: order.id,
        userId: order.user_id,
        currency: order.currency,
        totalCents: BigInt(order.total_cents),
        correlationId: idem,
        lines: c.items.map((i) => new OrderLine({
          productId: i.productId,
          sku: i.sku,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
      });

      const items = await pool.query<ItemRow>(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
      await cart.clearCart({ userId: req.userId }).catch(() => undefined);
      return toOrder(order, items.rows);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  },

  async getOrder(req) {
    const { rows } = await pool.query<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [req.id]);
    const o = rows[0];
    if (!o) throw new NotFound("order").toConnect();
    const items = await pool.query<ItemRow>(`SELECT * FROM order_items WHERE order_id = $1`, [o.id]);
    return toOrder(o, items.rows);
  },

  async listOrders(req) {
    const pageSize = Math.min(Math.max(req.pageSize || 20, 1), 100);
    const offset = req.pageToken ? Number(req.pageToken) : 0;
    const { rows } = await pool.query<OrderRow>(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, pageSize + 1, offset],
    );
    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const ids = slice.map((o) => o.id);
    const items = ids.length === 0
      ? { rows: [] as ItemRow[] }
      : await pool.query<ItemRow>(`SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])`, [ids]);
    const byOrder = new Map<string, ItemRow[]>();
    for (const row of items.rows) {
      const arr = byOrder.get(row.order_id) ?? [];
      arr.push(row);
      byOrder.set(row.order_id, arr);
    }
    return new ListOrdersResponse({
      orders: slice.map((o) => toOrder(o, byOrder.get(o.id) ?? [])),
      nextPageToken: hasMore ? String(offset + pageSize) : "",
    });
  },
};
