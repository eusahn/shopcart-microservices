import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { CatalogService } from "@shopcart/proto/catalog-connect";
import { config } from "./config.js";

const transport = createConnectTransport({
  baseUrl: config.CATALOG_SERVICE_URL,
  httpVersion: "1.1",
});

export const catalog = createPromiseClient(CatalogService, transport);
