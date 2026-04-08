"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  // Nos variables interactives React
  const [isLogin, setIsLogin] = useState(true); // Vrai = Connexion, Faux = Inscription
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter(); // L'outil de Next.js pour changer de page

  // Ce qui se passe quand on clique sur le gros bouton bleu
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Empêche la page de se rafraîchir bêtement
    setIsLoading(true);

    // Simulation de l'appel à la base de données (1.5 secondes)
    setTimeout(() => {
      // Dans un vrai projet, on vérifierait le mot de passe ici
      // Pour l'instant, on redirige vers le tableau de bord
      router.push('/dashboard'); 
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-light)' }}>
      
      {/* La carte blanche centrale */}
      <div style={{ background: 'white', padding: '3rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" className="logo" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dark)', textDecoration: 'none' }}>
            CRM<span style={{ color: 'var(--primary)' }}>AI</span>
          </Link>
          <p style={{ marginTop: '0.5rem', color: '#64748b' }}>Espace Entreprise</p>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          {isLogin ? "Se connecter" : "Créer mon compte"}
        </h2>

        {/* Le Formulaire Dynamique */}
        <form onSubmit={handleSubmit}>
          
          {/* Ce champ n'apparaît QUE si l'utilisateur est sur "Inscription" */}
          {!isLogin && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nom de l'entreprise</label>
              <input type="text" required placeholder="Ex: Tech Store" style={{ padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
            </div>
          )}

          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Email professionnel</label>
            <input type="email" required placeholder="nom@entreprise.com" style={{ padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
          </div>

          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mot de passe</label>
            <input type="password" required placeholder="••••••••" style={{ padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', opacity: isLoading ? 0.7 : 1, padding: '1rem', fontSize: '1rem' }} disabled={isLoading}>
            {isLoading ? "Traitement en cours..." : (isLogin ? "Connexion" : "S'inscrire gratuitement")}
          </button>
        </form>

        {/* Le lien magique pour basculer de connexion à inscription */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          {isLogin ? "Nouveau sur CRMAI ? " : "Déjà un compte ? "}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)} // Inverse la valeur !
            style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>
        </p>

      </div>
    </div>
  );
}