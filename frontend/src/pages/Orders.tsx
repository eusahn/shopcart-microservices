import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ScrollText } from "lucide-react";
import { listOrders } from "@/api";
import type { Order } from "@/types";
import { fmtMoney, statusLabel } from "@/types";
import type { AuthState } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const statusVariant = (s: string): "default" | "success" | "warning" | "destructive" => {
  if (s === "Paid" || s === "Fulfilled") return "success";
  if (s === "Pending" || s === "Reserved") return "warning";
  if (s === "Failed" || s === "Cancelled") return "destructive";
  return "default";
};

export function Orders({ auth }: { auth: AuthState }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!auth.authenticated) return;
    listOrders().then((r) => setOrders(r.orders)).catch((e: Error) => setError(e.message));
  }, [auth.authenticated]);

  if (!auth.authenticated) return <p className="text-muted-foreground text-center py-12">Log in to see your orders.</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (orders.length === 0) {
    return (
      <Card className="max-w-md mx-auto text-center py-12">
        <CardContent className="space-y-2">
          <ScrollText className="size-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No orders yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="space-y-0">
        {orders.map((o, idx) => {
          const label = statusLabel(o.status);
          return (
            <div key={o.id}>
              {idx > 0 && <Separator />}
              <Link to={`/orders/${o.id}`} className="flex items-center gap-4 py-4 hover:bg-accent/40 -mx-6 px-6 rounded transition-colors">
                <span className="font-mono text-sm flex-1 truncate">#{o.id.slice(0, 8)}</span>
                <Badge variant={statusVariant(label)}>{label}</Badge>
                <span className="font-semibold tabular-nums w-24 text-right">
                  {fmtMoney(o.totalCents, o.currency)}
                </span>
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
