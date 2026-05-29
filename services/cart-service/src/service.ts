import type { ServiceImpl } from "@connectrpc/connect";
import { CartService } from "@shopcart/proto/cart-connect";
import { Cart, CartItem, GetCartResponse } from "@shopcart/proto/cart";
import { InvalidArgument, NotFound } from "@shopcart/errors";
import { redis, cartKey } from "./redis.js";
import { catalog } from "./catalog-client.js";
import { config } from "./config.js";

interface StoredItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: string;
}

interface StoredCart {
  userId: string;
  items: StoredItem[];
  currency: string;
  updatedAt: number;
}

function emptyCart(userId: string): StoredCart {
  return { userId, items: [], currency: "USD", updatedAt: Math.floor(Date.now() / 1000) };
}

async function readCart(userId: string): Promise<StoredCart> {
  const raw = await redis.get(cartKey(userId));
  if (!raw) return emptyCart(userId);
  return JSON.parse(raw) as StoredCart;
}

async function writeCart(c: StoredCart): Promise<void> {
  c.updatedAt = Math.floor(Date.now() / 1000);
  await redis.set(cartKey(c.userId), JSON.stringify(c), "EX", config.CART_TTL_SECONDS);
}

function toProtoCart(c: StoredCart): Cart {
  const items = c.items.map((i) => new CartItem({
    productId: i.productId,
    sku: i.sku,
    name: i.name,
    quantity: i.quantity,
    unitPriceCents: BigInt(i.unitPriceCents),
  }));
  const subtotal = c.items.reduce((acc, i) => acc + BigInt(i.unitPriceCents) * BigInt(i.quantity), 0n);
  return new Cart({
    userId: c.userId,
    items,
    subtotalCents: subtotal,
    currency: c.currency,
    updatedAtUnix: BigInt(c.updatedAt),
  });
}

export const cartImpl: ServiceImpl<typeof CartService> = {
  async getCart(req) {
    if (!req.userId) throw new InvalidArgument("user_id is required").toConnect();
    const c = await readCart(req.userId);
    return new GetCartResponse({ cart: toProtoCart(c) });
  },

  async addItem(req) {
    if (!req.userId || !req.productId || req.quantity <= 0) {
      throw new InvalidArgument("user_id, product_id, and positive quantity required").toConnect();
    }
    const resp = await catalog.getProduct({ id: req.productId });
    if (!resp.product) throw new NotFound("product").toConnect();
    const p = resp.product;

    const c = await readCart(req.userId);
    c.currency = p.currency || c.currency;
    const existing = c.items.find((i) => i.productId === p.id);
    if (existing) existing.quantity += req.quantity;
    else c.items.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      quantity: req.quantity,
      unitPriceCents: p.priceCents.toString(),
    });
    await writeCart(c);
    return toProtoCart(c);
  },

  async updateItem(req) {
    const c = await readCart(req.userId);
    const item = c.items.find((i) => i.productId === req.productId);
    if (!item) throw new NotFound("cart item").toConnect();
    if (req.quantity <= 0) c.items = c.items.filter((i) => i.productId !== req.productId);
    else item.quantity = req.quantity;
    await writeCart(c);
    return toProtoCart(c);
  },

  async removeItem(req) {
    const c = await readCart(req.userId);
    c.items = c.items.filter((i) => i.productId !== req.productId);
    await writeCart(c);
    return toProtoCart(c);
  },

  async clearCart(req) {
    const c = emptyCart(req.userId);
    await writeCart(c);
    return toProtoCart(c);
  },
};
