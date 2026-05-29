import { OrderPlaced, EventMetadata, OrderLine } from "@shopcart/proto/events";
import { createKafka, TOPICS, injectTraceHeaders } from "@shopcart/kafka";
import { config } from "./config.js";
import { randomUUID } from "node:crypto";

export const kafka = createKafka({ clientId: config.SERVICE_NAME, brokers: config.KAFKA_BROKERS });

export async function emitOrderPlaced(args: {
  orderId: string;
  userId: string;
  lines: OrderLine[];
  totalCents: bigint;
  currency: string;
  correlationId: string;
}): Promise<void> {
  const headers = injectTraceHeaders();
  const traceparent = headers.traceparent ?? "";
  const event = new OrderPlaced({
    meta: new EventMetadata({
      eventId: randomUUID(),
      correlationId: args.correlationId,
      traceparent,
      occurredAtUnix: BigInt(Math.floor(Date.now() / 1000)),
      producer: config.SERVICE_NAME,
    }),
    orderId: args.orderId,
    userId: args.userId,
    lines: args.lines,
    totalCents: args.totalCents,
    currency: args.currency,
  });
  await kafka.producer.send({
    topic: TOPICS.ORDERS,
    messages: [
      {
        key: args.orderId,
        value: Buffer.from(event.toBinary()),
        headers: { ...headers, "event-type": "OrderPlaced" },
      },
    ],
  });
}
