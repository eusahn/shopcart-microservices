import type { ServiceImpl } from "@connectrpc/connect";
import { CatalogService } from "@shopcart/proto/catalog-connect";
import { Product, GetProductResponse, ListProductsResponse, SearchProductsResponse } from "@shopcart/proto/catalog";
import { NotFound, InvalidArgument } from "@shopcart/errors";
import { pool } from "./db.js";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string;
  price_cents: string;
  currency: string;
  category: string;
  image_url: string;
  stock: number;
}

function rowToProduct(r: ProductRow): Product {
  return new Product({
    id: r.id,
    sku: r.sku,
    name: r.name,
    description: r.description,
    priceCents: BigInt(r.price_cents),
    currency: r.currency,
    category: r.category,
    imageUrl: r.image_url,
    stock: r.stock,
  });
}

export const catalogImpl: ServiceImpl<typeof CatalogService> = {
  async getProduct(req) {
    if (!req.id) throw new InvalidArgument("id is required").toConnect();
    const { rows } = await pool.query<ProductRow>(`SELECT * FROM products WHERE id = $1`, [req.id]);
    const row = rows[0];
    if (!row) throw new NotFound("product").toConnect();
    return new GetProductResponse({ product: rowToProduct(row) });
  },

  async listProducts(req) {
    const pageSize = Math.min(Math.max(req.pageSize || 20, 1), 100);
    const offset = req.pageToken ? Number(req.pageToken) : 0;
    const params: unknown[] = [];
    let where = "";
    if (req.category) { params.push(req.category); where = `WHERE category = $${params.length}`; }
    params.push(pageSize + 1, offset);
    const { rows } = await pool.query<ProductRow>(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    return new ListProductsResponse({
      products: slice.map(rowToProduct),
      nextPageToken: hasMore ? String(offset + pageSize) : "",
    });
  },

  async searchProducts(req) {
    if (!req.query) throw new InvalidArgument("query is required").toConnect();
    const pageSize = Math.min(Math.max(req.pageSize || 20, 1), 100);
    const { rows } = await pool.query<ProductRow>(
      `SELECT *, ts_rank(tsv, plainto_tsquery('english', $1)) AS rank
       FROM products WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC LIMIT $2`,
      [req.query, pageSize],
    );
    return new SearchProductsResponse({ products: rows.map(rowToProduct) });
  },
};
