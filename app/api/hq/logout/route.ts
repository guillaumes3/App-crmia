import { NextResponse } from "next/server";
import { HQ_SESSION_COOKIE } from "@/app/utils/hqSession";
import { IDENTITY_SESSION_COOKIE } from "@/app/utils/identitySession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: HQ_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: IDENTITY_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
