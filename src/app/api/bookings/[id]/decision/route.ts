import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { decideBooking } from "@/lib/booking";
import { handle } from "@/lib/http";
import { readStore } from "@/lib/store";
import { sendBookingWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["host"]);
    const { id } = await context.params;
    const body = await request.json();
    const booking = await decideBooking(user.id, id, Boolean(body.accept));
    let whatsapp = "not_requested";
    if (booking.contactShared) {
      const notification = await readStore((store) => {
        const charger = store.chargers.find((item) => item.id === booking.chargerId);
        const customer = store.users.find((item) => item.id === booking.customerId);
        return charger && customer ? { chargerName: `${charger.manufacturer} ${charger.model}`, phone: customer.phone } : null;
      });
      whatsapp = notification
        ? await sendBookingWhatsApp({
            phone: notification.phone,
            bookingId: booking.id,
            chargerName: notification.chargerName,
            date: booking.date,
            start: booking.start,
            end: booking.end,
            total: booking.total,
            status: booking.status === "confirmed" ? "Confirmed" : "Declined",
          })
        : "failed";
    }
    return NextResponse.json({ booking, whatsapp });
  } catch (error) {
    return handle(error);
  }
}
