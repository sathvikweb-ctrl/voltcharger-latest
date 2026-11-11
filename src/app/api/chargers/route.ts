import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchChargers } from "@/lib/catalog";
import { enrollCharger, type EnrollInput } from "@/lib/enroll";
import { handle } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const num = (key: string) => {
    const value = url.searchParams.get(key);
    return value == null || value === "" ? undefined : Number(value);
  };
  const chargers = await searchChargers({
    q: url.searchParams.get("q") ?? undefined,
    lat: num("lat"),
    lng: num("lng"),
    radiusKm: num("radiusKm") ?? (url.searchParams.get("lat") ? 10 : undefined),
    type: url.searchParams.get("type") ?? undefined,
    minKw: num("minKw"),
    maxKw: num("maxKw"),
    maxPrice: num("maxPrice"),
    connector: url.searchParams.get("connector") ?? undefined,
    availableNow: url.searchParams.get("availableNow") === "1",
  });
  return NextResponse.json({ chargers, demo: true });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["host", "customer"]);
    const body = (await request.json()) as EnrollInput;
    const result = await enrollCharger(user, body);
    return NextResponse.json(result);
  } catch (error) {
    return handle(error);
  }
}
