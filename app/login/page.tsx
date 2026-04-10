"use client";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useRouter } from 'next/navigation';

const isRefreshTokenError = (error: { message?: string; name?: string } | null) => {
  const rawMessage = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return rawMessage.includes('refresh token');
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
    await supabase.auth.signOut();
    setSessionExpiredMessage("Votre session a expiré, veuillez vous reconnecter.");
    router.replace('/login');
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSessionExpiredMessage("");

    // 🛡️ ACCÈS DÉROBÉ POUR LE MASTER ADMIN
    if (email.toLowerCase() === "admin" && password === MASTER_PASSWORD) {
      setIsLoading(false);
      router.push('/master-admin');
      return;
    }

    if (isLogin) {
      // --- CONNEXION CLASSIQUE CLIENT ---
      const { error: signOutError } = await supabase.auth.signOut();
      if (isRefreshTokenError(signOutError)) {
        await resetCorruptedSession();
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (isRefreshTokenError(error)) {
          await resetCorruptedSession();
          setIsLoading(false);
          return;
        }

        alert("Erreur : " + error.message);
      } else {
        router.refresh();
        router.push('/backoffice/dashboard');
      }
    } else {
      // --- INSCRIPTION NOUVELLE ENTREPRISE ---
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert([{ nom: nomEntreprise }])
        .select().single();

      if (orgError) {
        alert("Erreur création entreprise");
        setIsLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            organisation_id: org.id, 
            role: 'Administrateur',
            nom: "Gérant" 
          }
        }
      });

      if (authError) {
        if (isRefreshTokenError(authError)) {
          await resetCorruptedSession();
          setIsLoading(false);
          return;
        }
        alert(authError.message);
      }
      else alert("Compte entreprise créé ! Vérifiez vos emails.");
    }
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', fontWeight: 800 }}>
             Connexion <span style={{ color: '#6366f1' }}>Kipilote</span>
        </h2>
        {sessionExpiredMessage && (
          <p style={{ color: '#6366f1', textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
            {sessionExpiredMessage}
          </p>
        )}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLogin && (
            <input 
              placeholder="Nom de votre Commerce" 
              value={nomEntreprise} 
              onChange={e => setNomEntreprise(e.target.value)} 
              required 
              style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
            />
          )}
          <input 
            type="text" // Changé de 'email' à 'text' pour accepter "admin"
            placeholder="Email ou identifiant" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
          />
          <input 
            type="password" 
            placeholder="Mot de passe" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
          />
          
          <button type="submit" disabled={isLoading} style={{ background: '#6366f1', color: 'white', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            {isLoading ? "Patientez..." : (isLogin ? "Se connecter" : "Lancer mon commerce")}
          </button>
        </form>
        <p onClick={() => setIsLogin(!isLogin)} style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6366f1', cursor: 'pointer', fontSize: '0.9rem' }}>
          {isLogin ? "Nouvelle entreprise ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
        </p>
      </div>
    </div>
  );
}
