import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catalog, cart, order, user } from "./clients.js";
import { requireAuth, type AuthedRequest } from "./auth.js";

const addItemBody = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const placeOrderBody = z.object({
  shippingAddressId: z.string().default(""),
  idempotencyKey: z.string().optional(),
});

const addAddressBody = z.object({
  line1: z.string().min(1),
  line2: z.string().default(""),
  city: z.string().min(1),
  region: z.string().default(""),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  isDefault: z.boolean().default(false),
});

function serializeBigInt<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v))) as T;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz",  async () => ({ ok: true }));

  // --- Catalog (public) ---
  app.get("/api/products", async (req) => {
    const q = req.query as { category?: string; pageSize?: string; pageToken?: string };
    const res = await catalog.listProducts({
      category: q.category ?? "",
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
      pageToken: q.pageToken ?? "",
    });
    return serializeBigInt(res);
  });

  app.get("/api/products/search", async (req) => {
    const q = req.query as { q: string };
    const res = await catalog.searchProducts({ query: q.q, pageSize: 20 });
    return serializeBigInt(res);
  });

  app.get("/api/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    const res = await catalog.getProduct({ id });
    return serializeBigInt(res);
  });

  // --- Cart (authed) ---
  app.get("/api/cart", { preHandler: requireAuth }, async (req: AuthedRequest) => {
    const res = await cart.getCart({ userId: req.user!.sub });
    return serializeBigInt(res);
  });

  app.post("/api/cart/items", { preHandler: requireAuth }, async (req: AuthedRequest, reply) => {
    const parsed = addItemBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const res = await cart.addItem({ userId: req.user!.sub, ...parsed.data });
    return serializeBigInt(res);
  });

  app.delete("/api/cart/items/:productId", { preHandler: requireAuth }, async (req: AuthedRequest) => {
    const { productId } = req.params as { productId: string };
    const res = await cart.removeItem({ userId: req.user!.sub, productId });
    return serializeBigInt(res);
  });

  // --- Orders ---
  app.post("/api/orders", { preHandler: requireAuth }, async (req: AuthedRequest, reply) => {
    const parsed = placeOrderBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const res = await order.placeOrder({
      userId: req.user!.sub,
      shippingAddressId: parsed.data.shippingAddressId,
      idempotencyKey: parsed.data.idempotencyKey ?? "",
    });
    return serializeBigInt(res);
  });

  app.get("/api/orders", { preHandler: requireAuth }, async (req: AuthedRequest) => {
    const res = await order.listOrders({ userId: req.user!.sub, pageSize: 20, pageToken: "" });
    return serializeBigInt(res);
  });

  app.get("/api/orders/:id", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const res = await order.getOrder({ id });
    return serializeBigInt(res);
  });

  // --- User / profile ---
  app.get("/api/me", { preHandler: requireAuth }, async (req: AuthedRequest) => {
    const res = await user.getUser({ id: req.user!.sub })
      .catch(async () => user.upsertProfile({
        id: req.user!.sub,
        email: (req.user!.email as string) ?? "",
        displayName: (req.user!.preferred_username as string) ?? "",
        phone: "",
      }).then((profile) => ({ profile })));
    return serializeBigInt(res);
  });

  app.post("/api/me/addresses", { preHandler: requireAuth }, async (req: AuthedRequest, reply) => {
    const parsed = addAddressBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const res = await user.addAddress({ userId: req.user!.sub, ...parsed.data });
    return serializeBigInt(res);
  });
}
