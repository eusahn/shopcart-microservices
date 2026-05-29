import type { ServiceImpl } from "@connectrpc/connect";
import { PaymentService } from "@shopcart/proto/payment-connect";
import { ChargeResponse, RefundResponse, PaymentStatus } from "@shopcart/proto/payment";
import { InvalidArgument } from "@shopcart/errors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

export const paymentImpl: ServiceImpl<typeof PaymentService> = {
  async charge(req) {
    if (req.amountCents <= 0n) throw new InvalidArgument("amount must be positive").toConnect();
    const fail = Math.random() < config.FAILURE_RATE;
    return new ChargeResponse({
      paymentId: randomUUID(),
      status: fail ? PaymentStatus.DECLINED : PaymentStatus.CAPTURED,
      declineReason: fail ? "simulated_decline" : "",
    });
  },
  async refund() {
    return new RefundResponse({ status: PaymentStatus.REFUNDED });
  },
};
