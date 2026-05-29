import { TOPICS, withConsumerSpan } from "@shopcart/kafka";
import {
  InventoryReserved,
  InventoryOutOfStock,
  PaymentCaptured,
  PaymentFailed,
} from "@shopcart/proto/events";
import { kafka } from "./events.js";
import { pool } from "./db.js";
import { createLogger } from "@shopcart/logger";
import { config } from "./config.js";

const log = createLogger({ serviceName: config.SERVICE_NAME });

// Closes the loop on the saga: order-service owns the order's status field,
// so it consumes the downstream events emitted by inventory/payment and
// transitions the order through PENDING → RESERVED → PAID (or → FAILED).
// Guarded transitions ensure we never regress (e.g. a late InventoryReserved
// after PaymentCaptured won't bump us back to RESERVED).
async function setStatus(orderId: string, next: string, allowedFrom: string[]): Promise<boolean> {
  const r = await pool.query(
    `UPDATE orders SET status = $1, updated_at = now()
     WHERE id = $2 AND status = ANY($3::text[])
     RETURNING id`,
    [next, orderId, allowedFrom],
  );
  return r.rowCount! > 0;
}

export async function startOrderConsumer(): Promise<void> {
  const consumer = kafka.consumer("order-service-saga");
  await consumer.connect();
  await consumer.subscribe({
    topics: [TOPICS.INVENTORY, TOPICS.PAYMENTS],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const type = message.headers?.["event-type"]?.toString() ?? "";
      if (!message.value) return;

      await withConsumerSpan("order-service", topic, message.headers, async () => {
        switch (type) {
          case "InventoryReserved": {
            const e = InventoryReserved.fromBinary(message.value!);
            const ok = await setStatus(e.orderId, "RESERVED", ["PENDING"]);
            if (ok) log.info({ orderId: e.orderId }, "→ RESERVED");
            break;
          }
          case "InventoryOutOfStock": {
            const e = InventoryOutOfStock.fromBinary(message.value!);
            const ok = await setStatus(e.orderId, "FAILED", ["PENDING", "RESERVED"]);
            if (ok) log.warn({ orderId: e.orderId, productIds: e.productIds }, "→ FAILED (out of stock)");
            break;
          }
          case "PaymentCaptured": {
            const e = PaymentCaptured.fromBinary(message.value!);
            const ok = await setStatus(e.orderId, "PAID", ["RESERVED"]);
            if (ok) log.info({ orderId: e.orderId }, "→ PAID");
            break;
          }
          case "PaymentFailed": {
            const e = PaymentFailed.fromBinary(message.value!);
            const ok = await setStatus(e.orderId, "FAILED", ["PENDING", "RESERVED"]);
            if (ok) log.warn({ orderId: e.orderId, reason: e.reason }, "→ FAILED (payment)");
            break;
          }
        }
      });
    },
  });
}
