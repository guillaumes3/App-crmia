import Link from 'next/link';

export default function Tarifs() {
  return (
    <div style={{ margin: 0, padding: 0, boxSizing: 'border-box', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER (Identique à l'accueil pour la cohérence) */}
      <header style={{
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        width: '100%'
      }}>
        <nav style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none' }}>
            CRM<span style={{ color: '#6366f1' }}>AI</span>
          </Link>

          <ul style={{
            display: 'flex',
            listStyle: 'none',
            gap: '30px',
            alignItems: 'center',
            margin: 0,
            padding: 0
          }}>
            <li><Link href="/" style={{ textDecoration: 'none', color: '#475569', fontWeight: 600 }}>Accueil</Link></li>
            <li><Link href="/tarifs" style={{ textDecoration: 'none', color: '#6366f1', fontWeight: 600 }}>Tarifs</Link></li>
            <li>
              <Link href="/login" style={{
                background: '#6366f1',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600
              }}>
                Se connecter
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {/* SECTION TARIFS */}
      <main style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#0f172a', marginBottom: '20px' }}>
            Des tarifs simples, <span style={{ color: '#6366f1' }}>sans surprise.</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#475569', marginBottom: '60px' }}>
            Choisissez le forfait adapté à la croissance de votre entreprise.
          </p>

          {/* GRILLE DES PRIX */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '30px',
            flexWrap: 'wrap'
          }}>
            
            {/* CARTE STARTER */}
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              width: '350px',
              textAlign: 'left',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Starter</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>29€<span style={{ fontSize: '1rem', color: '#64748b' }}>/mois</span></div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px', color: '#475569', lineHeight: '2' }}>
                <li>✅ 50 optimisations IA / mois</li>
                <li>✅ Déploiement Shopify</li>
                <li>❌ Support prioritaire</li>
              </ul>
              <Link href="/login" style={{
                display: 'block',
                textAlign: 'center',
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #6366f1',
                color: '#6366f1',
                textDecoration: 'none',
                fontWeight: 700
              }}>
                Essai gratuit
              </Link>
            </div>

            {/* CARTE PRO */}
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '20px',
              border: '2px solid #6366f1',
              width: '350px',
              textAlign: 'left',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '20px',
                background: '#6366f1',
                color: 'white',
                padding: '5px 15px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                POPULAIRE
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Business Pro</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>99€<span style={{ fontSize: '1rem', color: '#64748b' }}>/mois</span></div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px', color: '#475569', lineHeight: '2' }}>
                <li>✅ IA Illimitée</li>
                <li>✅ Amazon & Shopify</li>
                <li>✅ Support 24/7</li>
              </ul>
              <Link href="/login" style={{
                display: 'block',
                textAlign: 'center',
                padding: '12px',
                borderRadius: '10px',
                background: '#6366f1',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700
              }}>
                Devenir Pro
              </Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}