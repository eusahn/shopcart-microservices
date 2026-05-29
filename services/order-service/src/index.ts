import { startTelemetry } from "@shopcart/otel";
import { createLogger } from "@shopcart/logger";
import { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { OrderService } from "@shopcart/proto/order-connect";
import http from "node:http";
import { config } from "./config.js";
import { migrate, pool } from "./db.js";
import { orderImpl } from "./service.js";
import { kafka } from "./events.js";
import { startOrderConsumer } from "./consumer.js";

const log = createLogger({ serviceName: config.SERVICE_NAME, serviceVersion: config.SERVICE_VERSION });

async function main() {
  const otel = await startTelemetry({
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    metricsPort: config.METRICS_PORT,
  });

  await migrate();
  await kafka.producer.connect();
  log.info({ brokers: config.KAFKA_BROKERS }, "kafka connected");

  const router = (r: ConnectRouter) => r.service(OrderService, orderImpl);
  const server = http.createServer(connectNodeAdapter({ routes: router }));
  server.listen(config.GRPC_PORT, () => log.info({ port: config.GRPC_PORT }, "order-service listening"));

  startOrderConsumer().catch((err) => log.fatal({ err }, "order saga consumer crashed"));

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    server.close();
    await kafka.shutdown();
    await pool.end();
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
