import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

// In local dev, the browser hits Keycloak via the host port-forward
// (http://localhost:8181), so tokens carry that URL as their `iss` claim.
// The gateway runs inside the cluster though, and can only reach Keycloak via
// the cluster-internal service. So we split the two: KEYCLOAK_ISSUER is what
// we *expect* to see in the token; KEYCLOAK_JWKS_URL is where we actually go
// to fetch the public keys. They differ when the same Keycloak is reachable
// at multiple hostnames.
const JWKS_URL =
  config.KEYCLOAK_JWKS_URL ||
  `${config.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface AuthedRequest extends FastifyRequest {
  user?: JWTPayload & { sub: string; email?: string; preferred_username?: string };
}

export async function requireAuth(req: AuthedRequest, reply: FastifyReply): Promise<void> {
  if (config.AUTH_DISABLED) {
    req.user = { sub: (req.headers["x-dev-user"] as string) || "dev-user", email: "dev@example.com" };
    return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    void reply.code(401).send({ error: "missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.KEYCLOAK_ISSUER,
      audience: config.KEYCLOAK_AUDIENCE,
    });
    req.user = payload as AuthedRequest["user"];
  } catch (err) {
    void reply.code(401).send({ error: "invalid token", detail: (err as Error).message });
  }
}
