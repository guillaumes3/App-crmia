"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { setActiveUniverse } from "@/app/utils/universeState";

type BootstrapSessionResponse = {
  isHqStaff?: boolean;
  error?: string;
};

type TenantLoginClientProps = {
  tenantSlug: string;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  hasBranding: boolean;
};

export default function TenantLoginClient({
  tenantSlug,
  companyName,
  logoUrl,
  primaryColor,
  hasBranding,
}: TenantLoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [helperMessage, setHelperMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setHelperMessage("");

    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      await supabase.auth.signOut().catch(() => null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session?.access_token) {
        setHelperMessage(translateSupabaseAuthError(error?.message, "Connexion impossible."));
        setIsLoading(false);
        return;
      }

      const bootstrapResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          slug: tenantSlug,
        }),
      });

      const bootstrapBody = (await bootstrapResponse.json().catch(() => null)) as
        | BootstrapSessionResponse
        | null;

      if (!bootstrapResponse.ok || bootstrapBody?.isHqStaff) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        await supabase.auth.signOut().catch(() => null);
        setHelperMessage(bootstrapBody?.error ?? "Acces refuse pour cette entreprise.");
        setIsLoading(false);
        return;
      }

      setActiveUniverse("client");
      router.refresh();
      router.replace("/backoffice/dashboard");
    } catch {
      setHelperMessage("Erreur reseau. Merci de reessayer.");
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setHelperMessage("Saisissez votre email avant la reinitialisation.");
      return;
    }

    setIsLoading(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/update-password` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      setHelperMessage(translateSupabaseAuthError(error.message, "Impossible d envoyer le lien de reinitialisation."));
      setIsLoading(false);
      return;
    }

    setHelperMessage("Lien envoye. Verifiez votre boite email.");
    setIsLoading(false);
  };

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: `linear-gradient(145deg, ${primaryColor}14 0%, #f8fafc 45%, #ffffff 100%)`,
  };

  const brandDotStyle: CSSProperties = {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: primaryColor,
    boxShadow: `0 0 0 6px ${primaryColor}26`,
    flexShrink: 0,
  };

  const submitButtonStyle: CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: 10,
    padding: "11px 14px",
    fontWeight: 700,
    color: "white",
    background: primaryColor,
    cursor: "pointer",
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <header style={headerStyle}>
          <div style={brandTopStyle}>
            <span style={brandDotStyle} />
            <p style={brandLabelStyle}>Portail Entreprise</p>
          </div>

          <div style={logoRowStyle}>
            {logoUrl ? (
              <img src={logoUrl} alt={`Logo ${companyName}`} style={logoImageStyle} />
            ) : (
              <div style={{ ...logoFallbackStyle, color: primaryColor }}>{companyName.slice(0, 1).toUpperCase()}</div>
            )}
            <div>
              <h1 style={titleStyle}>{companyName}</h1>
              <p style={subtitleStyle}>Connexion securisee ({tenantSlug})</p>
            </div>
          </div>

          {!hasBranding ? (
            <p style={fallbackInfoStyle}>
              Aucun branding configure pour ce slug. Le theme par defaut est affiche.
            </p>
          ) : null}
        </header>

        <form onSubmit={onSubmit} style={formStyle}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={inputStyle}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={inputStyle}
            autoComplete="current-password"
          />

          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Verification..." : "Se connecter"}
          </button>

          <button type="button" disabled={isLoading} style={textButtonStyle} onClick={() => void handleForgotPassword()}>
            Mot de passe oublie ?
          </button>

          {helperMessage ? <p style={helperMessageStyle}>{helperMessage}</p> : null}
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
  if (normalized.includes("refresh token")) {
    return "Session expiree. Reessayez la connexion.";
  }
  return fallback;
}

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "white",
  borderRadius: 16,
  border: "1px solid #dbe3ee",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  padding: "26px",
};

const headerStyle: CSSProperties = {
  marginBottom: "18px",
};

const brandTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const brandLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "#475569",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const logoRowStyle: CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoImageStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  objectFit: "cover",
  border: "1px solid #e2e8f0",
};

const logoFallbackStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "1rem",
  background: "#f8fafc",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.25rem",
  fontWeight: 800,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "0.82rem",
};

const fallbackInfoStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: "0.8rem",
  color: "#64748b",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const inputStyle: CSSProperties = {
  border: "1px solid #dbe3ee",
  borderRadius: 10,
  background: "white",
  padding: "10px 12px",
  fontSize: "0.92rem",
};

const textButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#334155",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
  fontSize: "0.84rem",
  padding: 0,
  cursor: "pointer",
  justifySelf: "start",
};

const helperMessageStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: "0.84rem",
  color: "#0f172a",
};
