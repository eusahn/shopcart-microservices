// Mirrors the JSON the gateway returns. BigInt fields come back as strings
// because of the BigInt → string serialization on the server side.

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceCents: string;
  currency: string;
  category: string;
  imageUrl: string;
  stock: number;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  subtotalCents: string;
  currency: string;
  updatedAtUnix: string;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: string;
}

export type OrderStatus =
  | "ORDER_STATUS_UNSPECIFIED"
  | "ORDER_STATUS_PENDING"
  | "ORDER_STATUS_RESERVED"
  | "ORDER_STATUS_PAID"
  | "ORDER_STATUS_FULFILLED"
  | "ORDER_STATUS_FAILED"
  | "ORDER_STATUS_CANCELLED"
  | number;

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalCents: string;
  currency: string;
  status: OrderStatus;
  shippingAddressId: string;
  createdAtUnix: string;
  updatedAtUnix: string;
}

export const fmtMoney = (cents: string | number, currency = "USD") => {
  const n = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

export const statusLabel = (s: OrderStatus): string => {
  const map: Record<string, string> = {
    ORDER_STATUS_PENDING: "Pending",
    ORDER_STATUS_RESERVED: "Reserved",
    ORDER_STATUS_PAID: "Paid",
    ORDER_STATUS_FULFILLED: "Fulfilled",
    ORDER_STATUS_FAILED: "Failed",
    ORDER_STATUS_CANCELLED: "Cancelled",
  };
  if (typeof s === "string") return map[s] ?? s;
  const enumMap = ["Unknown", "Pending", "Reserved", "Paid", "Fulfilled", "Failed", "Cancelled"];
  return enumMap[s] ?? "Unknown";
};
