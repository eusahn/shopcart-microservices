import { startTelemetry } from "@shopcart/otel";
import { createLogger } from "@shopcart/logger";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";
import { ConnectError } from "@connectrpc/connect";

const log = createLogger({ serviceName: config.SERVICE_NAME, serviceVersion: config.SERVICE_VERSION });

async function main() {
  const otel = await startTelemetry({
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    metricsPort: config.METRICS_PORT,
  });

  const app = Fastify({ logger: { level: config.LOG_LEVEL }, disableRequestLogging: false, trustProxy: true });
  await app.register(cors, { origin: true, credentials: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConnectError) {
      // ConnectError.code maps roughly to HTTP via http2.codeToHttpStatus, but for simplicity:
      const status =
        err.code === 5  ? 404 :   // NotFound
        err.code === 3  ? 400 :   // InvalidArgument
        err.code === 6  ? 409 :   // AlreadyExists
        err.code === 9  ? 412 :   // FailedPrecondition
        err.code === 16 ? 401 :   // Unauthenticated
        err.code === 14 ? 503 :   // Unavailable
        500;
      return reply.code(status).send({ error: err.message, code: err.code });
    }
    log.error({ err }, "unhandled");
    return reply.code(500).send({ error: "internal" });
  });

  await registerRoutes(app);
  await app.listen({ port: config.HTTP_PORT, host: "0.0.0.0" });
  log.info({ port: config.HTTP_PORT }, "api-gateway listening");

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    await app.close();
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
