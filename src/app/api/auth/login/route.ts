import { NextResponse } from "next/server";
import { login, setSession } from "@/lib/auth";
import { handle } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await login(String(body.email ?? ""), String(body.password ?? ""));
    await setSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return handle(error);
  }
}
