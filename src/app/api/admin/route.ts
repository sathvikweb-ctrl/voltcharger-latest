import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  adminOverview,
  approveCustomPrice,
  recordRefund,
  resolveComplaint,
  setChargerStatus,
  suspendUser,
  updateSettings,
} from "@/lib/dashboard";
import { handle } from "@/lib/http";
import type { ListingStatus } from "@/lib/types";

export async function GET() {
  try {
    await requireUser(["admin"]);
    return NextResponse.json(await adminOverview());
  } catch (error) {
    return handle(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(["admin"]);
    const body = await request.json();
    switch (body.action) {
      case "charger-status":
        return NextResponse.json(await setChargerStatus(String(body.id), body.status as ListingStatus, body.reason));
      case "settings":
        return NextResponse.json(await updateSettings(body));
      case "suspend":
        return NextResponse.json(await suspendUser(String(body.userId), Boolean(body.suspended)));
      case "custom-price":
        return NextResponse.json(await approveCustomPrice(String(body.id), Boolean(body.approved)));
      case "refund":
        return NextResponse.json(await recordRefund(String(body.bookingId)));
      case "complaint":
        return NextResponse.json(await resolveComplaint(String(body.id)));
      default:
        return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
    }
  } catch (error) {
    return handle(error);
  }
}
