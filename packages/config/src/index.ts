import { z, type ZodTypeAny } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1),
  SERVICE_VERSION: z.string().default("0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  HTTP_PORT: z.coerce.number().int().positive().default(8080),
  GRPC_PORT: z.coerce.number().int().positive().default(50051),
  METRICS_PORT: z.coerce.number().int().positive().default(9090),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://otel-collector.observability.svc.cluster.local:4318"),
  OTEL_SERVICE_NAMESPACE: z.string().default("shopcart"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function loadConfig<TSchema extends ZodTypeAny>(
  schema: TSchema,
): BaseEnv & z.infer<TSchema> {
  const merged = baseEnvSchema.and(schema);
  const parsed = merged.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data as BaseEnv & z.infer<TSchema>;
}
