import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_SERVICE_NAMESPACE,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { metrics, trace } from "@opentelemetry/api";
import { collectDefaultMetrics, Registry } from "prom-client";
import http from "node:http";

export interface StartTelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  serviceNamespace?: string;
  otlpEndpoint?: string;
  metricsPort?: number;
}

// Boots OTel for traces (OTLP → Collector) and exposes a Prometheus /metrics endpoint
// for metrics. Metrics flow Prometheus-scrape, traces flow OTLP-push.
export async function startTelemetry(opts: StartTelemetryOptions): Promise<{ shutdown(): Promise<void> }> {
  const endpoint = opts.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: opts.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: opts.serviceVersion ?? "0.0.0",
    [SEMRESATTRS_SERVICE_NAMESPACE]: opts.serviceNamespace ?? "shopcart",
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
      }),
    ],
  });

  sdk.start();

  const registry = new Registry();
  registry.setDefaultLabels({ service: opts.serviceName });
  collectDefaultMetrics({ register: registry });

  const metricsPort = opts.metricsPort ?? Number(process.env.METRICS_PORT ?? 9090);
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    if (req.url === "/healthz" || req.url === "/readyz") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  metricsServer.listen(metricsPort);

  return {
    async shutdown() {
      await sdk.shutdown();
      await new Promise<void>((resolve) => metricsServer.close(() => resolve()));
    },
  };
}

export { metrics, trace };
