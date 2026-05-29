import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { Header } from "@/components/Header";
import { Products } from "@/pages/Products";
import { ProductDetail } from "@/pages/ProductDetail";
import { CartPage } from "@/pages/Cart";
import { Orders } from "@/pages/Orders";
import { OrderDetail } from "@/pages/OrderDetail";
import { Loader2 } from "lucide-react";

export function App() {
  const auth = useAuth();
  if (!auth.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin size-4" /> Loading…
      </div>
    );
  }
  return (
    <>
      <Header auth={auth} />
      <main className="container mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail auth={auth} />} />
          <Route path="/cart" element={<CartPage auth={auth} />} />
          <Route path="/orders" element={<Orders auth={auth} />} />
          <Route path="/orders/:id" element={<OrderDetail auth={auth} />} />
          <Route path="*" element={<p className="text-muted-foreground">Not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
