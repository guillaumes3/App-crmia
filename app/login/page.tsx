"use client";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { setActiveUniverse } from "@/app/utils/universeState";

type BootstrapSessionResponse = {
  isHqStaff?: boolean;
  error?: string;
};

const isRefreshTokenError = (error: { message?: string; name?: string } | null) => {
  const rawMessage = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return rawMessage.includes("refresh token");
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const router = useRouter();

  // --- TON MOT DE PASSE SECRET MASTER ---
  const MASTER_PASSWORD = "admin123";

  const resetCorruptedSession = useCallback(async () => {
    localStorage.clear();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    await supabase.auth.signOut();
    setSessionExpiredMessage("Votre session a expiré, veuillez vous reconnecter.");
    router.replace("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const validateStoredSession = async () => {
      const { error } = await supabase.auth.getSession();
      if (isRefreshTokenError(error)) {
        await resetCorruptedSession();
      }
    };

    void validateStoredSession();
  }, [resetCorruptedSession]);

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSessionExpiredMessage("");

    // 🛡️ ACCÈS DÉROBÉ POUR LE MASTER ADMIN
    if (email.toLowerCase() === "admin" && password === MASTER_PASSWORD) {
      setIsLoading(false);
      router.push("/master-admin");
      return;
    }

    if (isLogin) {
      // --- CONNEXION CLASSIQUE CLIENT ---
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (isRefreshTokenError(signOutError)) {
        await resetCorruptedSession();
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session?.access_token) {
        if (isRefreshTokenError(error)) {
          await resetCorruptedSession();
          setIsLoading(false);
          return;
        }

        alert(translateSupabaseAuthError(error?.message, "Connexion impossible."));
      } else {
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
          | BootstrapSessionResponse
          | null;

        if (!bootstrapResponse.ok) {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
          await supabase.auth.signOut();
          alert(bootstrapBody?.error ?? "Session invalide. Reconnectez-vous.");
          setIsLoading(false);
          return;
        }

        const isHqStaff = bootstrapBody?.isHqStaff === true;
        if (isHqStaff) {
          const hqLoginResponse = await fetch("/api/hq/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accessToken: data.session.access_token,
            }),
          });
          const hqLoginBody = (await hqLoginResponse.json().catch(() => null)) as
            | { error?: string }
            | null;

          if (!hqLoginResponse.ok) {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
            await supabase.auth.signOut();
            alert(hqLoginBody?.error ?? "Acces HQ refuse.");
            setIsLoading(false);
            return;
          }

          setActiveUniverse("hq");
          router.refresh();
          router.push("/hq/staff");
          setIsLoading(false);
          return;
        }

        setActiveUniverse("client");
        router.refresh();
        router.push("/backoffice/dashboard");
      }
    } else {
      // --- INSCRIPTION NOUVELLE ENTREPRISE ---
      const { data: org, error: orgError } = await supabase
        .from("organisations")
        .insert([{ nom: nomEntreprise }])
        .select()
        .single();

      if (orgError) {
        alert("Erreur lors de la creation de l entreprise.");
        setIsLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            organisation_id: org.id,
            role: "Administrateur",
            nom: "Gerant",
          },
        },
      });

      if (authError) {
        if (isRefreshTokenError(authError)) {
          await resetCorruptedSession();
          setIsLoading(false);
          return;
        }
        alert(translateSupabaseAuthError(authError.message, "Inscription impossible."));
      } else {
        alert("Compte entreprise cree. Verifiez vos emails.");
      }
    }
    setIsLoading(false);
  };

  return (
    <div style={pageContainerStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>
          Connexion <span style={titleAccentStyle}>Kipilote</span>
        </h2>
        {sessionExpiredMessage && (
          <p style={sessionMessageStyle}>
            {sessionExpiredMessage}
          </p>
        )}
        <form onSubmit={handleAuth} style={formStyle}>
          {!isLogin && (
            <input
              placeholder="Nom de votre commerce"
              value={nomEntreprise}
              onChange={(e) => setNomEntreprise(e.target.value)}
              required
              style={inputStyle}
            />
          )}
          <input
            type="text" // Changé de 'email' à 'text' pour accepter "admin"
            placeholder="Email ou identifiant"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? "Patientez..." : (isLogin ? "Se connecter" : "Lancer mon commerce")}
          </button>
        </form>
        <p onClick={() => setIsLogin(!isLogin)} style={switchModeStyle}>
          {isLogin ? "Nouvelle entreprise ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
        </p>
      </div>
    </div>
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
  if (normalized.includes("user already registered")) {
    return "Un compte existe deja avec cette adresse email.";
  }
  if (normalized.includes("signup is disabled")) {
    return "La creation de compte est desactivee pour le moment.";
  }
  if (normalized.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caracteres.";
  }
  return fallback;
}

const pageContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  background: "#f8fafc",
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  padding: "2.5rem",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "400px",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)",
};

const titleStyle: CSSProperties = {
  textAlign: "center",
  marginBottom: "30px",
  fontWeight: 800,
};

const titleAccentStyle: CSSProperties = {
  color: "#6366f1",
};

const sessionMessageStyle: CSSProperties = {
  color: "#6366f1",
  textAlign: "center",
  marginBottom: "1rem",
  fontSize: "0.9rem",
  fontWeight: 600,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const inputStyle: CSSProperties = {
  padding: "0.8rem",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const submitButtonStyle: CSSProperties = {
  background: "#6366f1",
  color: "#ffffff",
  padding: "1rem",
  borderRadius: "8px",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const switchModeStyle: CSSProperties = {
  textAlign: "center",
  marginTop: "1.5rem",
  color: "#6366f1",
  cursor: "pointer",
  fontSize: "0.9rem",
};
