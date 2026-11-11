import { NextResponse } from "next/server";
import { currentUser, requireUser } from "@/lib/auth";
import { getChargerForViewer } from "@/lib/catalog";
import { updateHostCharger } from "@/lib/dashboard";
import { handle } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const viewer = await currentUser();
  const result = await getChargerForViewer(id, viewer);
  if (!result) return NextResponse.json({ error: "Charger not found." }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["host"]);
    const { id } = await context.params;
    const body = await request.json();
    const charger = await updateHostCharger(user.id, id, body);
    return NextResponse.json({ id: charger.id, status: charger.status, bookingsDisabled: charger.bookingsDisabled });
  } catch (error) {
    return handle(error);
  }
}
