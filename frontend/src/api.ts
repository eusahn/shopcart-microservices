import { keycloak } from "./auth";
import type { Product, Cart, Order } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

async function authHeaders(): Promise<HeadersInit> {
  // When auth is disabled, the gateway expects an x-dev-user header.
  if (AUTH_DISABLED) return { "x-dev-user": "dev-user" };
  if (!keycloak?.authenticated) return {};
  try {
    await keycloak.updateToken(30);
  } catch {
    // refresh failed; let the request go without and the gateway will 401
  }
  return keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    "content-type": "application/json",
    ...(await authHeaders()),
    ...(init.headers ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Catalog
export const listProducts = (category?: string) =>
  request<{ products: Product[]; nextPageToken: string }>(
    `/products${category ? `?category=${encodeURIComponent(category)}` : ""}`,
  );
export const getProduct    = (id: string) => request<{ product: Product }>(`/products/${id}`);
export const searchProducts = (q: string) =>
  request<{ products: Product[] }>(`/products/search?q=${encodeURIComponent(q)}`);

// Cart
export const getCart  = () => request<{ cart: Cart }>(`/cart`);
export const addItem  = (productId: string, quantity: number) =>
  request<Cart>(`/cart/items`, { method: "POST", body: JSON.stringify({ productId, quantity }) });
export const removeItem = (productId: string) =>
  request<Cart>(`/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" });

// Orders
export const placeOrder = (idempotencyKey: string) =>
  request<Order>(`/orders`, {
    method: "POST",
    body: JSON.stringify({ shippingAddressId: "", idempotencyKey }),
  });
export const listOrders = () => request<{ orders: Order[] }>(`/orders`);
export const getOrder   = (id: string) => request<Order>(`/orders/${id}`);
