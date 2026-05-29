import { startTelemetry } from "@shopcart/otel";
import { createLogger } from "@shopcart/logger";
import { createKafka, TOPICS, withConsumerSpan } from "@shopcart/kafka";
import {
  PaymentCaptured, PaymentFailed, InventoryOutOfStock,
} from "@shopcart/proto/events";
import { config } from "./config.js";

const log = createLogger({ serviceName: config.SERVICE_NAME, serviceVersion: config.SERVICE_VERSION });

const kafka = createKafka({ clientId: config.SERVICE_NAME, brokers: config.KAFKA_BROKERS });

async function main() {
  const otel = await startTelemetry({
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    metricsPort: config.METRICS_PORT,
  });

  const consumer = kafka.consumer(config.KAFKA_GROUP_ID);
  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.PAYMENTS, TOPICS.INVENTORY], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const type = message.headers?.["event-type"]?.toString() ?? "";
      if (!message.value) return;
      await withConsumerSpan("notification-service", topic, message.headers, async () => {
        switch (type) {
          case "PaymentCaptured": {
            const e = PaymentCaptured.fromBinary(message.value!);
            log.info({ orderId: e.orderId, channel: "email", template: "order_confirmed" },
              "[mock email] Your order is confirmed!");
            break;
          }
          case "PaymentFailed": {
            const e = PaymentFailed.fromBinary(message.value!);
            log.warn({ orderId: e.orderId, channel: "email", template: "payment_failed" },
              "[mock email] Your payment failed.");
            break;
          }
          case "InventoryOutOfStock": {
            const e = InventoryOutOfStock.fromBinary(message.value!);
            log.warn({ orderId: e.orderId, channel: "email", template: "out_of_stock" },
              "[mock email] An item in your cart is out of stock.");
            break;
          }
        }
      });
    },
  });

  log.info("notification-service running");

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    await kafka.shutdown();
    await otel.shutdown();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.fatal({ err }, "failed to start");
  process.exit(1);
});
