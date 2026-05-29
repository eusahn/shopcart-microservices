import { startTelemetry } from "@shopcart/otel";
import { createLogger } from "@shopcart/logger";
import { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { PaymentService } from "@shopcart/proto/payment-connect";
import http from "node:http";
import { config } from "./config.js";
import { paymentImpl } from "./service.js";
import { kafka, startConsumer } from "./consumer.js";

const log = createLogger({ serviceName: config.SERVICE_NAME, serviceVersion: config.SERVICE_VERSION });

async function main() {
  const otel = await startTelemetry({
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    metricsPort: config.METRICS_PORT,
  });
  await kafka.producer.connect();
  const router = (r: ConnectRouter) => r.service(PaymentService, paymentImpl);
  const server = http.createServer(connectNodeAdapter({ routes: router }));
  server.listen(config.GRPC_PORT, () => log.info({ port: config.GRPC_PORT }, "payment-service listening"));

  startConsumer().catch((err) => log.fatal({ err }, "consumer crashed"));

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    server.close();
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
