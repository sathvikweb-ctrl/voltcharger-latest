import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { HttpError } from "./auth";
import { randomId } from "./crypto";
import { updateStore } from "./store";
import type { PublicUser } from "./types";

export function paymentMode() {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return "razorpay" as const;
  return "sandbox" as const;
}

export function createPaymentOrder(user: PublicUser, bookingId: string, method: string) {
  const allowed = ["upi", "debit_card", "credit_card", "netbanking"];
  if (!allowed.includes(method)) throw new HttpError(400, "Choose UPI, debit card, credit card, or net banking.");
  return updateStore((store) => {
    const booking = store.bookings.find((item) => item.id === bookingId && item.customerId === user.id);
    if (!booking) throw new HttpError(404, "Booking not found.");
    if (booking.status !== "pending_payment") throw new HttpError(400, "This booking is not waiting for payment.");
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date().toISOString()) {
      booking.status = "cancelled";
      booking.cancelReason = "Payment hold expired";
      throw new HttpError(400, "The 15-minute hold expired. Book the slot again.");
    }
    const mode = paymentMode();
    const orderId = mode === "sandbox" ? `order_sandbox_${randomBytes(6).toString("hex")}` : "";
    const sandboxToken = mode === "sandbox" ? randomBytes(16).toString("hex") : undefined;
    const payment = {
      id: randomId("pay"),
      bookingId: booking.id,
      orderId,
      amount: booking.total,
      currency: "INR" as const,
      status: "created" as const,
      mode,
      method,
      sandboxToken,
      createdAt: new Date().toISOString(),
    };
    store.payments = store.payments.filter((item) => !(item.bookingId === booking.id && item.status === "created"));
    if (mode === "razorpay") {
      payment.orderId = "pending_remote";
    }
    store.payments.push(payment);
    return {
      mode,
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      sandboxToken,
      method,
      keyId: mode === "razorpay" ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID : undefined,
      notice:
        mode === "sandbox"
          ? "Sandbox payment. No bank, UPI app, or card network is contacted, and no money moves."
          : "Razorpay order created. The booking is confirmed only after the server verifies the payment signature.",
    };
  });
}

async function createRazorpayOrder(amountRupees: number, receipt: string) {
  const key = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt }),
  });
  if (!response.ok) {
    throw new HttpError(502, "Razorpay did not create an order. Check the merchant keys.");
  }
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function attachRazorpayOrder(paymentId: string) {
  if (paymentMode() !== "razorpay") return;
  const draft = await updateStore((store) => store.payments.find((item) => item.id === paymentId));
  if (!draft || draft.mode !== "razorpay") return;
  const remoteId = await createRazorpayOrder(draft.amount, draft.bookingId);
  await updateStore((store) => {
    const payment = store.payments.find((item) => item.id === paymentId);
    if (payment) payment.orderId = remoteId;
  });
  return remoteId;
}

export function verifyPayment(user: PublicUser, input: {
  bookingId: string;
  orderId: string;
  method: string;
  sandboxToken?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}) {
  return updateStore((store) => {
    const booking = store.bookings.find((item) => item.id === input.bookingId && item.customerId === user.id);
    const payment = store.payments.find((item) => item.bookingId === input.bookingId && item.orderId === input.orderId);
    if (!booking || !payment) throw new HttpError(404, "Payment order not found.");
    if (payment.status === "verified" && booking.status !== "pending_payment") {
      return { booking, payment, receiptNo: payment.receiptNo };
    }
    if (booking.status !== "pending_payment") throw new HttpError(400, "Booking is not awaiting payment.");
    if (payment.mode === "sandbox") {
      if (!input.sandboxToken || !payment.sandboxToken || input.sandboxToken !== payment.sandboxToken) {
        payment.status = "failed";
        throw new HttpError(400, "Sandbox payment could not be verified.");
      }
    } else {
      const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
      const payload = `${input.orderId}|${input.razorpayPaymentId ?? ""}`;
      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      const given = input.razorpaySignature ?? "";
      const a = Buffer.from(expected);
      const b = Buffer.from(given);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        payment.status = "failed";
        throw new HttpError(400, "Payment signature verification failed. The booking stays unpaid.");
      }
    }
    payment.status = "verified";
    payment.method = input.method;
    payment.verifiedAt = new Date().toISOString();
    payment.receiptNo = `VCH-${new Date().getFullYear()}-${String(store.payments.filter((item) => item.receiptNo).length + 1).padStart(4, "0")}`;
    booking.status = store.settings.manualConfirmation ? "awaiting_host" : "confirmed";
    delete payment.sandboxToken;
    return { booking, payment, receiptNo: payment.receiptNo };
  });
}
