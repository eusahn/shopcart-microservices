import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, ShoppingBag } from "lucide-react";
import { getCart, removeItem, placeOrder } from "@/api";
import type { Cart } from "@/types";
import { fmtMoney } from "@/types";
import type { AuthState } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function CartPage({ auth }: { auth: AuthState }) {
  const nav = useNavigate();
  const [cart, setCart]       = useState<Cart | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const refresh = () =>
    getCart().then((r) => setCart(r.cart)).catch((e: Error) => setError(e.message));

  useEffect(() => { if (auth.authenticated) refresh(); }, [auth.authenticated]);

  if (!auth.authenticated) {
    return (
      <Card className="max-w-md mx-auto text-center py-12">
        <CardContent className="space-y-4">
          <ShoppingBag className="size-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Log in to see your cart.</p>
          <Button onClick={() => auth.login()}>Log in</Button>
        </CardContent>
      </Card>
    );
  }
  if (error) return <p className="text-destructive">{error}</p>;
  if (!cart) return <p className="text-muted-foreground">Loading…</p>;
  if (cart.items.length === 0) {
    return (
      <Card className="max-w-md mx-auto text-center py-12">
        <CardContent className="space-y-2">
          <ShoppingBag className="size-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button variant="outline" onClick={() => nav("/products")}>Browse catalog</Button>
        </CardContent>
      </Card>
    );
  }

  const onRemove = async (productId: string) => {
    await removeItem(productId);
    window.dispatchEvent(new Event("cart-changed"));
    await refresh();
  };

  const onCheckout = async () => {
    setPlacing(true); setError(null);
    try {
      const order = await placeOrder(crypto.randomUUID());
      window.dispatchEvent(new Event("cart-changed"));
      nav(`/orders/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Cart</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {cart.items.map((i, idx) => (
          <div key={i.productId}>
            {idx > 0 && <Separator />}
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{i.name}</div>
                <div className="text-muted-foreground text-xs">{i.sku}</div>
              </div>
              <div className="text-muted-foreground text-sm tabular-nums">× {i.quantity}</div>
              <div className="font-semibold tabular-nums w-20 text-right">
                {fmtMoney(i.unitPriceCents, cart.currency)}
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemove(i.productId)} aria-label="Remove">
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-6">
        <div className="text-base">
          Subtotal <span className="font-semibold ml-1">{fmtMoney(cart.subtotalCents, cart.currency)}</span>
        </div>
        <Button size="lg" onClick={onCheckout} disabled={placing}>
          {placing && <Loader2 className="animate-spin" />}
          Place order
        </Button>
      </CardFooter>
      {error && <p className="text-destructive text-sm px-6 -mt-3">{error}</p>}
    </Card>
  );
}
