"use client";
import { useState } from 'react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      // ON FORCE LA REDIRECTION VERS LE DASHBOARD
      window.location.replace('/backoffice/dashboard');
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: 'white', padding: '3rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.3rem', fontWeight: 700 }}>
          {isLogin ? "Se connecter" : "Créer mon compte"}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email professionnel</label>
            <input type="email" required style={{ padding: '0.7rem', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
          </div>
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mot de passe</label>
            <input type="password" required style={{ padding: '0.7rem', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
          </div>
          <button type="submit" style={{ width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            {isLoading ? "Connexion..." : (isLogin ? "Connexion" : "S'inscrire")}
          </button>
        </form>
      </div>
    </div>
  );
}