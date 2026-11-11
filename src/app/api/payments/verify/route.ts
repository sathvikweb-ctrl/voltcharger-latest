import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { verifyPayment } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    const user = await requireUser(["customer", "host"]);
    const body = await request.json();
    const result = await verifyPayment(user, body);
    return NextResponse.json({
      bookingId: result.booking.id,
      status: result.booking.status,
      receiptNo: result.receiptNo,
      mode: result.payment.mode,
      total: result.booking.total,
      amountLabel: result.booking.amountLabel,
    });
  } catch (error) {
    return handle(error);
  }
}
