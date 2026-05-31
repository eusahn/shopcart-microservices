import { loadConfig } from "@shopcart/config";
import { z } from "zod";

const schema = z.object({
  CATALOG_SERVICE_URL:  z.string().url(),
  CART_SERVICE_URL:     z.string().url(),
  USER_SERVICE_URL:     z.string().url(),
  ORDER_SERVICE_URL:    z.string().url(),
  PAYMENT_SERVICE_URL:  z.string().url(),
  KEYCLOAK_ISSUER:      z.string().url(),
  KEYCLOAK_JWKS_URL:    z.string().url().optional(),
  KEYCLOAK_AUDIENCE:    z.string().default("account"),
  AUTH_DISABLED:        z.coerce.boolean().default(false),
});

export const config = loadConfig(schema);
