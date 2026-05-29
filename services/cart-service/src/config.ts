import { loadConfig } from "@shopcart/config";
import { z } from "zod";

const schema = z.object({
  REDIS_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
  CART_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
});

export const config = loadConfig(schema);
