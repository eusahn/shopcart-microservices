import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "@/types";
import { fmtMoney } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.id}`} className="group">
      <Card className="overflow-hidden py-0 transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <span className="text-5xl text-muted-foreground/40 font-light">
              {product.name.charAt(0)}
            </span>
          )}
        </div>
        <CardContent className="py-4">
          <div className="font-medium leading-tight line-clamp-1">{product.name}</div>
          <div className="text-muted-foreground text-xs mt-0.5">{product.sku}</div>
          <div className="font-semibold mt-2">
            {fmtMoney(product.priceCents, product.currency)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
