import { NextResponse } from "next/server";
import { quoteBooking } from "@/lib/booking";
import { handle } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await quoteBooking(body));
  } catch (error) {
    return handle(error);
  }
}
