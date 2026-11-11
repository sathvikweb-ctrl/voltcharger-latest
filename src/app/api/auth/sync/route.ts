import { NextResponse } from "next/server";
import { syncSupabaseHost, verifiedSupabaseUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const authUser = await verifiedSupabaseUser();
    const body = await request.json();
    const user = await syncSupabaseHost(authUser, {
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
    });
    return NextResponse.json({ user });
  } catch (error) {
    return handle(error);
  }
}
