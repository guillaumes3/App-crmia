import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ margin: 0, padding: 0, boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
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
          {/* LOGO */}
          <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none' }}>
            CRM<span style={{ color: '#6366f1' }}>AI</span>
          </Link>

          {/* MENU */}
          <ul style={{
            display: 'flex',
            listStyle: 'none',
            gap: '30px',
            alignItems: 'center',
            margin: 0,
            padding: 0
          }}>
            <li><Link href="/" style={{ textDecoration: 'none', color: '#475569', fontWeight: 600 }}>Accueil</Link></li>
            <li><Link href="/tarifs" style={{ textDecoration: 'none', color: '#475569', fontWeight: 600 }}>Tarifs</Link></li>
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

      {/* HERO SECTION */}
      <main style={{
        padding: '100px 20px',
        textAlign: 'center',
        background: 'radial-gradient(circle at top, #e0e7ff 0%, #f8fafc 100%)',
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '20px', lineHeight: '1.1' }}>
            Vendez plus vite grâce à <span style={{ color: '#6366f1' }}>l'Intelligence Artificielle</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#475569', marginBottom: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
            Rédigez vos fiches produits et déployez-les sur Amazon et Shopify en un clic.
          </p>
          <Link href="/login" style={{
            background: '#6366f1',
            color: 'white',
            padding: '15px 30px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '1.1rem',
            display: 'inline-block'
          }}>
            Démarrer gratuitement
          </Link>
        </div>
      </main>
    </div>
  );
}