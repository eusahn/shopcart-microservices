import { createKafka, TOPICS, withConsumerSpan, injectTraceHeaders } from "@shopcart/kafka";
import {
  InventoryReserved, PaymentCaptured, PaymentFailed, EventMetadata,
} from "@shopcart/proto/events";
import { config } from "./config.js";
import { createLogger } from "@shopcart/logger";
import { randomUUID } from "node:crypto";

const log = createLogger({ serviceName: config.SERVICE_NAME });

export const kafka = createKafka({ clientId: config.SERVICE_NAME, brokers: config.KAFKA_BROKERS });

export async function startConsumer(): Promise<void> {
  const consumer = kafka.consumer(config.KAFKA_GROUP_ID);
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.INVENTORY, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const eventType = message.headers?.["event-type"]?.toString() ?? "";
      if (eventType !== "InventoryReserved" || !message.value) return;

      await withConsumerSpan("payment-service", topic, message.headers, async () => {
        const reserved = InventoryReserved.fromBinary(message.value!);
        const fail = Math.random() < config.FAILURE_RATE;
        const headers = injectTraceHeaders();
        const meta = new EventMetadata({
          eventId: randomUUID(),
          correlationId: reserved.meta?.correlationId ?? "",
          traceparent: headers.traceparent ?? "",
          occurredAtUnix: BigInt(Math.floor(Date.now() / 1000)),
          producer: config.SERVICE_NAME,
        });
        if (fail) {
          const ev = new PaymentFailed({ meta, orderId: reserved.orderId, reason: "simulated_decline" });
          await kafka.producer.send({
            topic: TOPICS.PAYMENTS,
            messages: [{
              key: reserved.orderId,
              value: Buffer.from(ev.toBinary()),
              headers: { ...headers, "event-type": "PaymentFailed" },
            }],
          });
          log.warn({ orderId: reserved.orderId }, "payment failed");
        } else {
          const ev = new PaymentCaptured({
            meta, orderId: reserved.orderId, paymentId: randomUUID(), amountCents: 0n,
          });
          await kafka.producer.send({
            topic: TOPICS.PAYMENTS,
            messages: [{
              key: reserved.orderId,
              value: Buffer.from(ev.toBinary()),
              headers: { ...headers, "event-type": "PaymentCaptured" },
            }],
          });
          log.info({ orderId: reserved.orderId }, "payment captured");
        }
      });
    },
  });
}
