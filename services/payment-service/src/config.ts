import { loadConfig } from "@shopcart/config";
import { z } from "zod";

const schema = z.object({
  KAFKA_BROKERS: z.string().transform((s) => s.split(",").map((b) => b.trim()).filter(Boolean)),
  KAFKA_GROUP_ID: z.string().default("payment-service"),
  FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.05),
});

export const config = loadConfig(schema);
