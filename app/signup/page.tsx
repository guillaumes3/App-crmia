"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const orgSlug = params.get("org");
    const nextUrl = orgSlug ? `/login?signup=1&org=${encodeURIComponent(orgSlug)}` : "/login?signup=1";
    router.replace(nextUrl);
  }, [router]);

  return <p style={{ padding: "2rem" }}>Redirection vers l inscription...</p>;
}
