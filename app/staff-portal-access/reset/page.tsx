"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";

export default function StaffPasswordResetPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("error");

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setHasRecoverySession(Boolean(data.session));
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(Boolean(session));
      }
    });

    void init();
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setIsLoading(true);

    try {
      if (!hasRecoverySession) {
        setFeedbackTone("error");
        setFeedback("Session de recuperation invalide. Recommencez via le lien email.");
        return;
      }

      if (newPassword.length < 8) {
        setFeedbackTone("error");
        setFeedback("Le mot de passe doit contenir au moins 8 caracteres.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setFeedbackTone("error");
        setFeedback("La confirmation ne correspond pas.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setFeedbackTone("error");
        setFeedback(error.message);
        return;
      }

      await supabase.auth.signOut();
      setFeedbackTone("success");
      setFeedback("Mot de passe mis a jour. Redirection...");
      setTimeout(() => {
        router.replace("/staff-portal-access?reset=success");
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <header style={logoHeaderStyle}>
          <span style={logoMarkStyle}>◉</span>
          <div>
            <div style={logoTitleStyle}>KIPILOTE</div>
            <div style={logoSubtitleStyle}>Reinitialisation Mot de Passe</div>
          </div>
        </header>

        <form onSubmit={submit} style={formStyle}>
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
            placeholder="Confirmer le mot de passe"
            autoComplete="new-password"
            required
            style={inputStyle}
          />
          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Patientez..." : "Mettre a jour"}
          </button>
          {feedback ? (
            <p style={feedbackTone === "error" ? feedbackErrorStyle : feedbackSuccessStyle}>{feedback}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle: React.CSSProperties = {
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

const logoHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const logoMarkStyle: React.CSSProperties = {
  color: "#3730a3",
  fontSize: "1rem",
};

const logoTitleStyle: React.CSSProperties = {
  color: "#3730a3",
  fontSize: "1.2rem",
  fontWeight: 900,
  letterSpacing: "0.03em",
};

const logoSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "0.84rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "11px 12px",
  fontSize: "0.92rem",
  color: "#334155",
  outline: "none",
};

const submitButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "14px",
  background: "#818cf8",
  color: "#ffffff",
  padding: "11px 12px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "4px",
};

const feedbackErrorStyle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#be123c",
  fontSize: "0.82rem",
};

const feedbackSuccessStyle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#0f766e",
  fontSize: "0.82rem",
};
