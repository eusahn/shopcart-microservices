import pino, { type Logger, type LoggerOptions } from "pino";
import { trace } from "@opentelemetry/api";

export type AppLogger = Logger;

export interface CreateLoggerOptions {
  serviceName: string;
  serviceVersion?: string;
  level?: LoggerOptions["level"];
}

// Structured JSON logger. Loki picks these up via Promtail's stdout scrape.
// Trace context is mixed in so logs are correlatable with traces in Grafana.
export function createLogger(opts: CreateLoggerOptions): AppLogger {
  return pino({
    level: opts.level ?? process.env.LOG_LEVEL ?? "info",
    base: {
      service: opts.serviceName,
      version: opts.serviceVersion ?? process.env.SERVICE_VERSION ?? "0.0.0",
      env: process.env.NODE_ENV ?? "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
      log(obj) {
        const span = trace.getActiveSpan();
        if (!span) return obj;
        const ctx = span.spanContext();
        return { ...obj, trace_id: ctx.traceId, span_id: ctx.spanId };
      },
    },
  });
}
