import { loadConfig } from "@shopcart/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PG_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
});

export const config = loadConfig(schema);
