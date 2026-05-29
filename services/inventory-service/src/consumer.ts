import { createKafka, TOPICS, withConsumerSpan, injectTraceHeaders } from "@shopcart/kafka";
import {
  OrderPlaced, InventoryReserved, InventoryOutOfStock, EventMetadata,
} from "@shopcart/proto/events";
import { config } from "./config.js";
import { reserveLines } from "./service.js";
import { createLogger } from "@shopcart/logger";
import { randomUUID } from "node:crypto";

const log = createLogger({ serviceName: config.SERVICE_NAME });

export const kafka = createKafka({ clientId: config.SERVICE_NAME, brokers: config.KAFKA_BROKERS });

export async function startConsumer(): Promise<void> {
  const consumer = kafka.consumer(config.KAFKA_GROUP_ID);
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const eventType = message.headers?.["event-type"]?.toString() ?? "";
      if (eventType !== "OrderPlaced" || !message.value) return;

      await withConsumerSpan("inventory-service", topic, message.headers, async () => {
        const placed = OrderPlaced.fromBinary(message.value!);
        log.info({ orderId: placed.orderId, lines: placed.lines.length }, "received OrderPlaced");

        const result = await reserveLines(
          placed.orderId,
          placed.lines.map((l) => ({ productId: l.sku || l.productId, quantity: l.quantity })),
        );

        const headers = injectTraceHeaders();
        const meta = new EventMetadata({
          eventId: randomUUID(),
          correlationId: placed.meta?.correlationId ?? "",
          traceparent: headers.traceparent ?? "",
          occurredAtUnix: BigInt(Math.floor(Date.now() / 1000)),
          producer: config.SERVICE_NAME,
        });
        if (result.ok) {
          const ev = new InventoryReserved({ meta, orderId: placed.orderId });
          await kafka.producer.send({
            topic: TOPICS.INVENTORY,
            messages: [{
              key: placed.orderId,
              value: Buffer.from(ev.toBinary()),
              headers: { ...headers, "event-type": "InventoryReserved" },
            }],
          });
          log.info({ orderId: placed.orderId }, "reserved");
        } else {
          const ev = new InventoryOutOfStock({
            meta, orderId: placed.orderId, productIds: result.outOfStock,
          });
          await kafka.producer.send({
            topic: TOPICS.INVENTORY,
            messages: [{
              key: placed.orderId,
              value: Buffer.from(ev.toBinary()),
              headers: { ...headers, "event-type": "InventoryOutOfStock" },
            }],
          });
          log.warn({ orderId: placed.orderId, outOfStock: result.outOfStock }, "out of stock");
        }
      });
    },
  });
}
