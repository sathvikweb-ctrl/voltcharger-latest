import { NextResponse } from "next/server";
import { slotsFor } from "@/lib/catalog";
import { estimateDurationMinutes } from "@/lib/pricing";
import { readStore } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const energy = Number(url.searchParams.get("energy") ?? "10");
  const vehicle = Number(url.searchParams.get("vehicleLimit") ?? "0");
  const charger = await readStore((store) => store.chargers.find((item) => item.id === id));
  if (!charger) return NextResponse.json({ slots: [] });
  let minutes = 60;
  try {
    minutes = estimateDurationMinutes(energy, charger.capacityKw, vehicle > 0 ? vehicle : charger.capacityKw);
  } catch {
    minutes = charger.minDurationMin;
  }
  const reserveMinutes = Math.max(minutes, charger.minDurationMin);
  return NextResponse.json({ slots: await slotsFor(id, date, reserveMinutes), reserveMinutes });
}
