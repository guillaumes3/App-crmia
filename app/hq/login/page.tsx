"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { setActiveUniverse } from "@/app/utils/universeState";

type AuthBootstrapResponse = {
  isHqStaff?: boolean;
  error?: string;
};

type HqLoginResponse = {
  redirectTo?: string;
  error?: string;
};

export default function HqLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;

    const guardSessionContext = async () => {
      try {
        const hqMeResponse = await fetch("/api/hq/me");
        if (!isMounted) return;
        if (hqMeResponse.ok) {
          setActiveUniverse("hq");
          router.replace("/hq/staff");
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!isMounted || !data.session?.access_token) return;

        const bootstrapResponse = await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: data.session.access_token,
          }),
        });

        const bootstrapBody = (await bootstrapResponse.json().catch(() => null)) as
          | AuthBootstrapResponse
          | null;

        if (!isMounted || !bootstrapResponse.ok) return;

        if (bootstrapBody?.isHqStaff) {
          const hqLoginResponse = await fetch("/api/hq/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accessToken: data.session.access_token,
              isHq: true,
            }),
          });

          if (!isMounted) return;
          if (hqLoginResponse.ok) {
            const payload = (await hqLoginResponse.json().catch(() => null)) as HqLoginResponse | null;
            setActiveUniverse("hq");
            router.replace(payload?.redirectTo ?? "/hq/staff");
          }
          return;
        }

        setActiveUniverse("client");
        router.replace("/backoffice/dashboard");
      } catch {
        // No-op: si les checks échouent, on laisse l'utilisateur saisir ses identifiants.
      }
    };

    void guardSessionContext();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setFeedback("");

    const formData = new FormData(event.currentTarget);
    const isHqAttempt = formData.get("isHq") === "true";

    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      await supabase.auth.signOut().catch(() => null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session?.access_token) {
        setFeedback(translateSupabaseAuthError(error?.message, "Acces Maison Mere refuse."));
        return;
      }

      const hqLoginResponse = await fetch("/api/hq/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          isHq: isHqAttempt,
        }),
      });

      if (!hqLoginResponse.ok) {
        const payload = (await hqLoginResponse.json().catch(() => null)) as HqLoginResponse | null;
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        await supabase.auth.signOut().catch(() => null);
        setFeedback(payload?.error || "Profil non autorise pour l espace HQ.");
        return;
      }

      const payload = (await hqLoginResponse.json().catch(() => null)) as HqLoginResponse | null;
      setActiveUniverse("hq");
      router.replace(payload?.redirectTo ?? "/hq/staff");
    } catch {
      setFeedback("Une erreur est survenue. Merci de reessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <header style={headerStyle}>
          <p style={logoLabelStyle}>Kipilote HQ</p>
          <h1 style={titleStyle}>Connexion Maison Mere</h1>
          <p style={warningStyle}>Espace securise - Acces reserve au personnel administratif</p>
        </header>

        <form onSubmit={onSubmit} style={formStyle}>
          <input type="hidden" name="isHq" value="true" />

          <label style={labelStyle} htmlFor="hq-email">
            Email professionnel
          </label>
          <input
            id="hq-email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
            placeholder="prenom.nom@kipilote.com"
            style={inputStyle}
          />

          <label style={labelStyle} htmlFor="hq-password">
            Mot de passe
          </label>
          <input
            id="hq-password"
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            style={inputStyle}
          />

          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Verification..." : "Acceder au portail HQ"}
          </button>

          {feedback ? <p style={errorTextStyle}>{feedback}</p> : null}
        </form>
      </section>
    </main>
  );
}

function translateSupabaseAuthError(message: string | undefined, fallback: string) {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Identifiants invalides. Verifiez votre email et votre mot de passe.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Email non confirme. Verifiez votre boite mail.";
  }
  if (normalized.includes("too many requests")) {
    return "Trop de tentatives. Reessayez dans quelques minutes.";
  }
  if (normalized.includes("network request failed")) {
    return "Connexion reseau impossible. Verifiez votre connexion internet.";
  }
  return fallback;
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "18px",
  padding: "30px",
  boxShadow: "0 30px 70px rgba(2, 6, 23, 0.45)",
};

const headerStyle: CSSProperties = {
  marginBottom: "24px",
};

const logoLabelStyle: CSSProperties = {
  margin: 0,
  color: "#818cf8",
  fontWeight: 800,
  letterSpacing: "0.03em",
  fontSize: "0.85rem",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "6px 0 12px 0",
  color: "#f8fafc",
  fontSize: "1.85rem",
  fontWeight: 900,
};

const warningStyle: CSSProperties = {
  margin: 0,
  color: "#fbbf24",
  fontSize: "0.9rem",
  lineHeight: 1.5,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const labelStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: "10px",
  padding: "12px 14px",
  fontSize: "0.95rem",
  outlineColor: "#6366f1",
};

const submitButtonStyle: CSSProperties = {
  marginTop: "8px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "0.95rem",
  cursor: "pointer",
};

const errorTextStyle: CSSProperties = {
  margin: "6px 0 0 0",
  color: "#fda4af",
  fontSize: "0.86rem",
};
