import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getOrder } from "@/api";
import type { Order } from "@/types";
import { fmtMoney, statusLabel } from "@/types";
import type { AuthState } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const statusVariant = (s: string): "default" | "success" | "warning" | "destructive" => {
  if (s === "Paid" || s === "Fulfilled") return "success";
  if (s === "Pending" || s === "Reserved") return "warning";
  if (s === "Failed" || s === "Cancelled") return "destructive";
  return "default";
};

export function OrderDetail({ auth }: { auth: AuthState }) {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.authenticated) return;
    getOrder(id).then(setOrder).catch((e: Error) => setError(e.message));
  }, [auth.authenticated, id]);

  if (!auth.authenticated) return <p className="text-muted-foreground text-center py-12">Log in to view this order.</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!order) return <p className="text-muted-foreground">Loading…</p>;

  const label = statusLabel(order.status);

  return (
    <article className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/orders"><ArrowLeft />All orders</Link>
      </Button>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="font-mono text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
            <Badge variant={statusVariant(label)}>{label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {order.items.map((i, idx) => (
            <div key={i.productId}>
              {idx > 0 && <Separator />}
              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.name}</div>
                  <div className="text-muted-foreground text-xs">{i.sku}</div>
                </div>
                <div className="text-muted-foreground text-sm tabular-nums">× {i.quantity}</div>
                <div className="font-semibold tabular-nums w-20 text-right">
                  {fmtMoney(i.unitPriceCents, order.currency)}
                </div>
              </div>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex items-center justify-between pt-3 pb-1">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-lg tabular-nums">
              {fmtMoney(order.totalCents, order.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">What just happened behind the scenes</p>
          <p>
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">order-service</code> emitted{" "}
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">OrderPlaced</code> to{" "}
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">orders.events</code>;{" "}
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">inventory-service</code> reserved stock,{" "}
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">payment-service</code> simulated capture, and{" "}
            <code className="bg-background px-1.5 py-0.5 rounded text-xs">notification-service</code> logged the
            "mock email" — all on the same trace_id. Look at the trace in Grafana → Tempo.
          </p>
        </CardContent>
      </Card>
    </article>
  );
}
