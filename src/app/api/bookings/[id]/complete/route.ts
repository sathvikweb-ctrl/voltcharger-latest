import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { completeBooking } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["host"]);
    const { id } = await context.params;
    const body = await request.json();
    const booking = await completeBooking(user.id, id, Number(body.actualKwh));
    return NextResponse.json({ booking });
  } catch (error) {
    return handle(error);
  }
}
