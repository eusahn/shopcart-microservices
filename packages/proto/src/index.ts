// Convenience barrel — service code usually imports from the granular subpaths
// declared in package.json#exports (e.g. "@shopcart/proto/catalog").

export * from "./gen/catalog/v1/catalog_pb.js";
export * from "./gen/cart/v1/cart_pb.js";
export * from "./gen/user/v1/user_pb.js";
export * from "./gen/order/v1/order_pb.js";
export * from "./gen/inventory/v1/inventory_pb.js";
export * from "./gen/payment/v1/payment_pb.js";
export * from "./gen/events/v1/events_pb.js";
