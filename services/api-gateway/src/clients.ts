import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { CatalogService } from "@shopcart/proto/catalog-connect";
import { CartService } from "@shopcart/proto/cart-connect";
import { UserService } from "@shopcart/proto/user-connect";
import { OrderService } from "@shopcart/proto/order-connect";
import { PaymentService } from "@shopcart/proto/payment-connect";
import { config } from "./config.js";

const tx = (baseUrl: string) => createConnectTransport({ baseUrl, httpVersion: "1.1" });

export const catalog = createPromiseClient(CatalogService, tx(config.CATALOG_SERVICE_URL));
export const cart    = createPromiseClient(CartService,    tx(config.CART_SERVICE_URL));
export const user    = createPromiseClient(UserService,    tx(config.USER_SERVICE_URL));
export const order   = createPromiseClient(OrderService,   tx(config.ORDER_SERVICE_URL));
export const payment = createPromiseClient(PaymentService, tx(config.PAYMENT_SERVICE_URL));
