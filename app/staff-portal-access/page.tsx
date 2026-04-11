"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { setActiveUniverse } from "@/app/utils/universeState";

type AuthMode = "signin" | "forgot" | "first";

export default function StaffPortalAccessPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("error");

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const response = await fetch("/api/hq/me", { method: "GET" });
      if (!isMounted) return;
      if (response.ok) {
        setActiveUniverse("hq");
        router.replace("/hq/staff");
      }
    };

    void checkSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") {
      setFeedbackTone("success");
      setFeedback("Mot de passe mis a jour. Vous pouvez vous connecter.");
      setMode("signin");
    }
  }, []);

  const submitLabel = useMemo(() => {
    if (mode === "forgot") return "Envoyer le lien";
    if (mode === "first") return "Activer mon acces";
    return "Entrer";
  }, [mode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setIsLoading(true);

    try {
      if (mode === "forgot") {
        await handleForgotPassword();
        return;
      }

      if (mode === "first") {
        await handleFirstConnection();
        return;
      }

      await handleSignIn();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.session?.access_token) {
      setFeedbackTone("error");
      setFeedback(translateSupabaseAuthError(error?.message, "Acces refuse."));
      return;
    }

    await finalizeHqLogin(data.session.access_token);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setFeedbackTone("error");
      setFeedback("Email requis.");
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/staff-portal-access/reset`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setFeedbackTone("error");
      setFeedback(translateSupabaseAuthError(error.message, "Impossible d envoyer le lien de reinitialisation."));
      return;
    }

    setFeedbackTone("success");
    setFeedback("Lien envoye. Verifiez votre boite email.");
  };

  const handleFirstConnection = async () => {
    if (!email.trim() || !temporaryPassword) {
      setFeedbackTone("error");
      setFeedback("Email et mot de passe temporaire requis.");
      return;
    }

    if (newPassword.length < 8) {
      setFeedbackTone("error");
      setFeedback("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedbackTone("error");
      setFeedback("La confirmation ne correspond pas.");
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: temporaryPassword,
    });

    if (signInError || !signInData.session?.access_token) {
      setFeedbackTone("error");
      setFeedback(translateSupabaseAuthError(signInError?.message, "Mot de passe temporaire invalide."));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setFeedbackTone("error");
      setFeedback(translateSupabaseAuthError(updateError.message, "Impossible de mettre a jour le mot de passe."));
      return;
    }

    const { data: refreshed } = await supabase.auth.getSession();
    const token = refreshed.session?.access_token ?? signInData.session.access_token;
    await finalizeHqLogin(token);
  };

  const finalizeHqLogin = async (accessToken: string) => {
    const loginResponse = await fetch("/api/hq/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken,
      }),
    });

    if (!loginResponse.ok) {
      const body = (await loginResponse.json().catch(() => null)) as { error?: string } | null;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      await supabase.auth.signOut();
      setFeedbackTone("error");
      setFeedback(body?.error || "Profil HQ non autorise.");
      return;
    }

    const payload = (await loginResponse.json()) as { redirectTo?: string };
    setActiveUniverse("hq");
    router.replace(payload.redirectTo ?? "/hq/staff");
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <header style={logoHeaderStyle}>
          <span style={logoMarkStyle}>◉</span>
          <div>
            <div style={logoTitleStyle}>KIPILOTE</div>
            <div style={logoSubtitleStyle}>Collaborateurs Maison Mere</div>
          </div>
        </header>

        <div style={modeSwitchStyle}>
          <button type="button" onClick={() => setMode("signin")} style={modeButtonStyle(mode === "signin")}>
            Connexion
          </button>
          <button type="button" onClick={() => setMode("first")} style={modeButtonStyle(mode === "first")}>
            Premiere connexion
          </button>
          <button type="button" onClick={() => setMode("forgot")} style={modeButtonStyle(mode === "forgot")}>
            Mot de passe oublie
          </button>
        </div>

        <form onSubmit={onSubmit} style={formStyle}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Adresse email"
            autoComplete="username"
            required
            style={inputStyle}
          />

          {mode === "signin" ? (
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          ) : null}

          {mode === "first" ? (
            <>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Mot de passe temporaire"
                autoComplete="current-password"
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </>
          ) : null}

          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Patientez..." : submitLabel}
          </button>

          {feedback ? (
            <p style={feedbackTone === "error" ? feedbackErrorStyle : feedbackSuccessStyle}>{feedback}</p>
          ) : null}
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
  if (normalized.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caracteres.";
  }
  return fallback;
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  padding: "26px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const logoHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const logoMarkStyle: CSSProperties = {
  color: "#3730a3",
  fontSize: "1rem",
};

const logoTitleStyle: CSSProperties = {
  color: "#3730a3",
  fontSize: "1.2rem",
  fontWeight: 900,
  letterSpacing: "0.03em",
};

const logoSubtitleStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.84rem",
};

const modeSwitchStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  background: "#f8fafc",
  borderRadius: "16px",
  padding: "8px",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "11px 12px",
  fontSize: "0.92rem",
  color: "#334155",
  outline: "none",
};

const submitButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "14px",
  background: "#818cf8",
  color: "#ffffff",
  padding: "11px 12px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "4px",
};

const feedbackErrorStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#be123c",
  fontSize: "0.82rem",
};

const feedbackSuccessStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#0f766e",
  fontSize: "0.82rem",
};

const modeButtonStyle = (active: boolean): CSSProperties => ({
  border: "none",
  borderRadius: "12px",
  padding: "8px 10px",
  background: active ? "#6366f1" : "#e2e8f0",
  color: active ? "#ffffff" : "#475569",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.78rem",
});
