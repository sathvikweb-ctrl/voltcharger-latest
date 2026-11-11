import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["customer", "host"]);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const booking = await cancelBooking(user, id, String(body.reason ?? ""));
    return NextResponse.json({ booking });
  } catch (error) {
    return handle(error);
  }
}
