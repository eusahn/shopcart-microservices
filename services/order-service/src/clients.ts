import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { CartService } from "@shopcart/proto/cart-connect";
import { config } from "./config.js";

export const cart = createPromiseClient(
  CartService,
  createConnectTransport({ baseUrl: config.CART_SERVICE_URL, httpVersion: "1.1" }),
);
