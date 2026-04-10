"use client";
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '25px 50px', alignItems: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 950, letterSpacing: '-1.5px' }}>
          KIPILOTE<span style={{ color: '#6366f1' }}>.</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>Connexion</button>
          <button onClick={() => router.push('/login')} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Essai Gratuit</button>
        </div>
      </nav>

      <header style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 950, letterSpacing: '-2px', marginBottom: '20px' }}>
          Pilotez votre business avec une <span style={{ color: '#6366f1' }}>clarté absolue.</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto' }}>
          La solution de gestion tout-en-un pour vos stocks, vos ventes et vos équipes.
        </p>
        <button onClick={() => router.push('/login')} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '20px 40px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer' }}>
          Démarrer maintenant
        </button>
      </header>
    </div>
  );
}