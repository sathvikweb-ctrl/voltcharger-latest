import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { customerDashboard, hostDashboard } from "@/lib/dashboard";
import { handle } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "host") return NextResponse.json({ role: "host", ...await hostDashboard(user.id) });
    if (user.role === "admin") return NextResponse.json({ role: "admin" });
    return NextResponse.json({ role: "customer", ...await customerDashboard(user.id) });
  } catch (error) {
    return handle(error);
  }
}
