import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShoppingCart, LogOut, ScrollText, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCart } from "@/api";
import type { AuthState } from "@/auth";

export function Header({ auth }: { auth: AuthState }) {
  const nav = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!auth.authenticated) { setCartCount(0); return; }
    let cancelled = false;
    const refresh = () =>
      getCart()
        .then((r) => { if (!cancelled) setCartCount(r.cart.items.reduce((a, i) => a + i.quantity, 0)); })
        .catch(() => undefined);
    refresh();
    const handler = () => refresh();
    window.addEventListener("cart-changed", handler);
    return () => { cancelled = true; window.removeEventListener("cart-changed", handler); };
  }, [auth.authenticated]);

  return (
    <header className="border-b bg-background/95 sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-6 max-w-6xl">
        <Link to="/products" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-xl">🛒</span> ShopCart
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/products"><Store />Catalog</Link>
          </Button>

          {auth.authenticated && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders"><ScrollText />Orders</Link>
            </Button>
          )}

          <Button variant="ghost" size="sm" asChild className="relative">
            <Link to="/cart">
              <ShoppingCart />Cart
              {cartCount > 0 && (
                <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">{cartCount}</Badge>
              )}
            </Link>
          </Button>

          <div className="ml-2 flex items-center gap-2">
            {auth.authenticated ? (
              <>
                <span className="text-muted-foreground text-sm hidden sm:inline">
                  {auth.username ?? "you"}
                </span>
                <Button variant="outline" size="sm" onClick={() => { auth.logout(); nav("/products"); }}>
                  <LogOut /> Log out
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => auth.login()}>Log in</Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
