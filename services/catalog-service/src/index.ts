import { startTelemetry } from "@shopcart/otel";
import { createLogger } from "@shopcart/logger";
import { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { CatalogService } from "@shopcart/proto/catalog-connect";
import http from "node:http";
import { config } from "./config.js";
import { migrate, seedIfEmpty, pool } from "./db.js";
import { catalogImpl } from "./service.js";

const log = createLogger({ serviceName: config.SERVICE_NAME, serviceVersion: config.SERVICE_VERSION });

async function main() {
  const otel = await startTelemetry({
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    metricsPort: config.METRICS_PORT,
  });

  await migrate();
  await seedIfEmpty();
  log.info("database ready");

  const router = (r: ConnectRouter) => r.service(CatalogService, catalogImpl);
  const server = http.createServer(connectNodeAdapter({ routes: router }));
  server.listen(config.GRPC_PORT, () => log.info({ port: config.GRPC_PORT }, "catalog-service listening"));

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    server.close();
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
