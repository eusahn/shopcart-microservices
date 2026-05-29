import { loadConfig } from "@shopcart/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PG_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  KAFKA_BROKERS: z.string().transform((s) => s.split(",").map((b) => b.trim()).filter(Boolean)),
  CART_SERVICE_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
});

export const config = loadConfig(schema);
