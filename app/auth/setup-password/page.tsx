"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { setActiveUniverse } from "@/app/utils/universeState";

type BootstrapSessionResponse = {
  isHqStaff?: boolean;
  error?: string;
};

export default function SetupPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("error");

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasSession(Boolean(data.session));
      if (!data.session) {
        setFeedbackTone("error");
        setFeedback("Session invalide. Reconnectez-vous pour configurer votre mot de passe.");
      }
    };

    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setIsLoading(true);

    try {
      if (!hasSession) {
        setFeedbackTone("error");
        setFeedback("Session absente. Merci de vous reconnecter.");
        return;
      }

      if (newPassword.length < 6) {
        setFeedbackTone("error");
        setFeedback("Le mot de passe doit contenir au moins 6 caracteres.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setFeedbackTone("error");
        setFeedback("La confirmation ne correspond pas.");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.id) {
        setFeedbackTone("error");
        setFeedback("Utilisateur introuvable. Reconnectez-vous.");
        return;
      }

      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateAuthError) {
        setFeedbackTone("error");
        setFeedback(updateAuthError.message);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("auth_user_id", userData.user.id);

      if (profileError) {
        setFeedbackTone("error");
        setFeedback(
          "Mot de passe modifie, mais impossible de mettre a jour le profil. " +
            "Vous devrez contacter un administrateur. Detail: " +
            profileError.message,
        );
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setFeedbackTone("error");
        setFeedback("Session invalide apres mise a jour. Reconnectez-vous.");
        return;
      }

      const bootstrapResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken }),
      });

      const bootstrapBody = (await bootstrapResponse.json().catch(() => null)) as BootstrapSessionResponse | null;
      if (!bootstrapResponse.ok) {
        setFeedbackTone("error");
        setFeedback(bootstrapBody?.error ?? "Session invalide. Reconnectez-vous.");
        return;
      }

      setFeedbackTone("success");
      setFeedback("Mot de passe configure. Redirection...");
      if (bootstrapBody?.isHqStaff) {
        setActiveUniverse("hq");
        router.refresh();
        router.replace("/hq/staff");
        return;
      }

      setActiveUniverse("client");
      router.refresh();
      router.replace("/backoffice/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>Configuration du mot de passe</h1>
          <p style={subtitleStyle}>Definissez votre mot de passe personnel pour finaliser votre premiere connexion.</p>
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
            placeholder="Confirmation du mot de passe"
            autoComplete="new-password"
            required
            style={inputStyle}
          />

          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Mise a jour..." : "Valider et continuer"}
          </button>
          {feedback ? <p style={feedbackTone === "error" ? feedbackErrorStyle : feedbackSuccessStyle}>{feedback}</p> : null}
        </form>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.25rem",
  fontWeight: 900,
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "0.9rem",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "11px 12px",
  fontSize: "0.92rem",
  color: "#334155",
  outline: "none",
};

const submitButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  padding: "11px 12px",
  fontWeight: 800,
  cursor: "pointer",
  marginTop: "4px",
};

const feedbackErrorStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#be123c",
  fontSize: "0.84rem",
};

const feedbackSuccessStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#0f766e",
  fontSize: "0.84rem",
};
