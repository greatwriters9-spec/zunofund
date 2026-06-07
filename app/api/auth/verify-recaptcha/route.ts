import { NextResponse } from "next/server";

import { verifyRecaptchaToken } from "@/lib/recaptcha/verifyServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const result = await verifyRecaptchaToken(token);

  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
