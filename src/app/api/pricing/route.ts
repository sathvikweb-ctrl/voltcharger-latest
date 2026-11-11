import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET() {
  const settings = await readStore((store) => store.settings);
  return NextResponse.json({
    pricing: settings.pricing,
    commissionRate: settings.commissionRate,
    platformFee: settings.platformFee,
    gstRate: settings.gstRate,
    manualConfirmation: settings.manualConfirmation,
  });
}
