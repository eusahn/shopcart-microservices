import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import { getProduct, addItem } from "@/api";
import type { Product } from "@/types";
import { fmtMoney } from "@/types";
import type { AuthState } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetail({ auth }: { auth: AuthState }) {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty]         = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getProduct(id).then((r) => setProduct(r.product)).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!product) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const onAdd = async () => {
    if (!auth.authenticated) { auth.login(); return; }
    setPending(true); setError(null);
    try {
      await addItem(product.id, qty);
      window.dispatchEvent(new Event("cart-changed"));
      nav("/cart");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/products"><ArrowLeft />Back to catalog</Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-2 items-start">
        <div className="aspect-square rounded-xl border bg-muted overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <div className="size-full flex items-center justify-center text-6xl text-muted-foreground/40">
              {product.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
            <div className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
              <span>SKU {product.sku}</span> · <Badge variant="outline">{product.category}</Badge>
            </div>
          </div>

          <p className="text-muted-foreground">{product.description}</p>

          <div className="text-3xl font-bold">
            {fmtMoney(product.priceCents, product.currency)}
          </div>

          <div className="flex items-end gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <Input
                type="number"
                min={1}
                max={product.stock || 99}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
            </label>
            <Button size="lg" onClick={onAdd} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
              {auth.authenticated ? "Add to cart" : "Log in to buy"}
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      </div>
    </article>
  );
}
