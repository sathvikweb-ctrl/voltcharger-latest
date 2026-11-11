import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { attachRazorpayOrder, createPaymentOrder } from "@/lib/payments";
import { readStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const user = await requireUser(["customer", "host"]);
    const body = await request.json();
    const order = await createPaymentOrder(user, String(body.bookingId ?? ""), String(body.method ?? "upi"));
    if (order.mode === "razorpay") {
      const remoteId = await attachRazorpayOrder(order.paymentId);
      const saved = await readStore((store) => store.payments.find((item) => item.id === order.paymentId));
      return NextResponse.json({ ...order, orderId: remoteId ?? saved?.orderId, sandboxToken: undefined });
    }
    return NextResponse.json(order);
  } catch (error) {
    return handle(error);
  }
}
