import { NextResponse } from "next/server";
import { clearSession, requireUser } from "@/lib/auth";
import { addComplaint, addReview, deleteHostAccount, saveLocation, toggleFavourite } from "@/lib/dashboard";
import { handle } from "@/lib/http";

export async function DELETE() {
  try {
    const user = await requireUser(["host"]);
    await deleteHostAccount(user.id);
    await clearSession();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (body.action === "favourite") return NextResponse.json({ favouriteChargerIds: await toggleFavourite(user.id, String(body.chargerId)) });
    if (body.action === "location") return NextResponse.json({ savedLocations: await saveLocation(user.id, body) });
    if (body.action === "review") return NextResponse.json(await addReview(user.id, body));
    if (body.action === "complaint") return NextResponse.json(await addComplaint(user.id, String(body.message ?? ""), body.bookingId));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return handle(error);
  }
}
