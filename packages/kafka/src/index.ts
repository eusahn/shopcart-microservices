import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import { context, propagation, trace, SpanKind } from "@opentelemetry/api";

export const TOPICS = {
  ORDERS: "orders.events",
  INVENTORY: "inventory.events",
  PAYMENTS: "payments.events",
  NOTIFICATIONS: "notifications.events",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

export interface KafkaClients {
  producer: Producer;
  consumer(groupId: string): Consumer;
  shutdown(): Promise<void>;
}

export interface CreateKafkaOptions {
  clientId: string;
  brokers: string[];
}

export function createKafka(opts: CreateKafkaOptions): KafkaClients {
  const kafka = new Kafka({
    clientId: opts.clientId,
    brokers: opts.brokers,
    logLevel: logLevel.WARN,
    retry: { initialRetryTime: 200, retries: 8 },
  });

  const producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
  const consumers: Consumer[] = [];

  return {
    producer,
    consumer(groupId: string) {
      const c = kafka.consumer({ groupId, sessionTimeout: 30_000 });
      consumers.push(c);
      return c;
    },
    async shutdown() {
      await Promise.allSettled([
        producer.disconnect(),
        ...consumers.map((c) => c.disconnect()),
      ]);
    },
  };
}

// Inject W3C traceparent into Kafka headers so the consumer side can continue the trace.
export function injectTraceHeaders(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

export async function withConsumerSpan<T>(
  tracerName: string,
  topic: string,
  headers: Record<string, string | Buffer | (string | Buffer)[] | undefined> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (typeof v === "string") carrier[k] = v;
    else if (Buffer.isBuffer(v)) carrier[k] = v.toString("utf8");
  }
  const parentCtx = propagation.extract(context.active(), carrier);
  const tracer = trace.getTracer(tracerName);
  return await tracer.startActiveSpan(
    `kafka.consume ${topic}`,
    { kind: SpanKind.CONSUMER, attributes: { "messaging.system": "kafka", "messaging.destination.name": topic } },
    parentCtx,
    async (span) => {
      try {
        const out = await fn();
        span.end();
        return out;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: 2, message: (err as Error).message });
        span.end();
        throw err;
      }
    },
  );
}
