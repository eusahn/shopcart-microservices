import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { listProducts, searchProducts } from "@/api";
import type { Product } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [query, setQuery]       = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      const op = query.trim()
        ? searchProducts(query.trim()).then((r) => r.products)
        : listProducts().then((r) => r.products);
      op
        .then(setProducts)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-muted-foreground text-sm">Browse the demo store.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products…"
            value={query}
            onChange={(e) => { setLoading(true); setQuery(e.target.value); }}
            className="pl-9"
          />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>

      {!loading && products.length === 0 && (
        <p className="text-muted-foreground text-center py-12">No products match that search.</p>
      )}
    </section>
  );
}
