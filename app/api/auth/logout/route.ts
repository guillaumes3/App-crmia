import { NextResponse } from "next/server";
import { IDENTITY_SESSION_COOKIE } from "@/app/utils/identitySession";
import { HQ_SESSION_COOKIE } from "@/app/utils/hqSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: IDENTITY_SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });

  response.cookies.set({
    name: HQ_SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });

  return response;
}
