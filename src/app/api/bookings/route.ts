import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createBooking } from "@/lib/booking";
import { customerDashboard } from "@/lib/dashboard";
import { handle } from "@/lib/http";
import { sendBookingWhatsApp } from "@/lib/whatsapp";
import { readStore } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "customer") return NextResponse.json(customerDashboard(user.id));
    return NextResponse.json({ error: "Open the host dashboard for host bookings." }, { status: 400 });
  } catch (error) {
    return handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["customer"]);
    const body = await request.json();
    const result = await createBooking(user, body);
    const whatsapp = body.shareContact
      ? await readStore((store) => {
          const charger = store.chargers.find((item) => item.id === result.booking.chargerId);
          return charger
            ? sendBookingWhatsApp({
                phone: user.phone,
                bookingId: result.booking.id,
                chargerName: `${charger.manufacturer} ${charger.model}`,
                date: result.booking.date,
                start: result.booking.start,
                end: result.booking.end,
                total: result.booking.total,
                status: result.booking.status === "awaiting_host" ? "Awaiting host approval" : "Confirmed",
              })
            : Promise.resolve("failed" as const);
        })
      : "not_requested";
    return NextResponse.json({ ...result, whatsapp });
  } catch (error) {
    return handle(error);
  }
}
