"use client";
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
      
      {/* NAVIGATION */}
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '20px 50px', 
        alignItems: 'center', background: 'white', borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 1000 
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 950, letterSpacing: '-1.5px' }}>
          KIPILOTE<span style={{ color: '#6366f1' }}>.</span>
        </div>
        <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
          <button onClick={() => scrollToSection('pricing')} style={navLinkStyle}>Tarifs</button>
          <button onClick={() => router.push('/login')} style={navLinkStyle}>Connexion</button>
          <button onClick={() => router.push('/login')} style={btnPrimarySmall}>Essai Gratuit</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header id="features" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 950, letterSpacing: '-2px', lineHeight: 1.1, marginBottom: '25px' }}>
          Le pilotage business <br/>en toute <span style={{ color: '#6366f1' }}>simplicité.</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#64748b', maxWidth: '650px', margin: '0 auto 45px auto', lineHeight: 1.6 }}>
          Gerez vos stocks, suivez vos ventes et coordonnez vos equipes avec Kipilote. L'ERP nouvelle generation pour les entreprises ambitieuses.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/login')} style={btnDarkLarge}>Acceder a mon espace</button>
          <button onClick={() => scrollToSection('pricing')} style={btnLightLarge}>Voir les plans</button>
        </div>
      </header>

      {/* SECTION TARIFS */}
      <section id="pricing" style={{ padding: '100px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '15px' }}>Une offre claire et sans surprise.</h2>
          <p style={{ color: '#64748b' }}>Choisissez le plan qui correspond a la taille de votre activite.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          
          {/* Plan Gratuit */}
          <div style={priceCard}>
            <h3 style={priceTitle}>Demarrage</h3>
            <div style={priceValue}>0€<span style={priceMonth}>/mois</span></div>
            <ul style={featureList}>
              <li style={featureItem}>Jusqu'a 50 articles</li>
              <li style={featureItem}>1 collaborateur</li>
              <li style={featureItem}>Gestion de stock de base</li>
              <li style={featureItem}>Support par email</li>
            </ul>
            <button onClick={() => router.push('/login')} style={btnPrice}>Commencer gratuitement</button>
          </div>

          {/* Plan Pro */}
          <div style={{ ...priceCard, border: '2px solid #6366f1', transform: 'scale(1.05)', boxShadow: '0 20px 40px rgba(99, 102, 241, 0.1)' }}>
            <div style={badgePro}>PLUS POPULAIRE</div>
            <h3 style={priceTitle}>Croissance</h3>
            <div style={priceValue}>29€<span style={priceMonth}>/mois</span></div>
            <ul style={featureList}>
              <li style={featureItem}>Articles illimites</li>
              <li style={featureItem}>Equipe illimitee</li>
              <li style={featureItem}>Filtres de recherche avances</li>
              <li style={featureItem}>Support prioritaire 7j/7</li>
            </ul>
            <button onClick={() => router.push('/login')} style={{ ...btnPrice, background: '#6366f1' }}>Choisir le plan Pro</button>
          </div>

        </div>
      </section>

      {/* SECTION CONTACT */}
      <section id="contact" style={{ background: '#f8fafc', padding: '80px 20px 90px 20px' }}>
        <div style={{ maxWidth: '920px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>Contactez-nous</h2>
            <p style={{ color: '#64748b' }}>Une question sur Kipilote ? Ecrivez-nous et notre equipe vous repond rapidement.</p>
          </div>

          <form onSubmit={handleContactSubmit} style={contactFormStyle}>
            <div style={contactGrid}>
              <input className="contact-input" type="text" name="name" placeholder="Nom" required style={contactInputStyle} />
              <input className="contact-input" type="email" name="email" placeholder="Email" required style={contactInputStyle} />
            </div>
            <input className="contact-input" type="text" name="subject" placeholder="Sujet" required style={contactInputStyle} />
            <textarea className="contact-textarea" name="message" placeholder="Message" required rows={5} style={contactTextareaStyle} />
            <button type="submit" style={contactSubmitStyle}>Envoyer</button>
          </form>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '44px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-1px', marginBottom: '10px' }}>
              KIPILOTE<span style={{ color: '#6366f1' }}>.</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>
              Notre mission : simplifier le pilotage quotidien des entreprises avec un ERP clair, rapide et fiable.
            </p>
          </div>

          <div>
            <h3 style={footerTitleStyle}>Liens Rapides</h3>
            <div style={footerLinkListStyle}>
              <button onClick={() => scrollToSection('pricing')} style={footerLinkButton}>Tarifs</button>
              <button onClick={() => scrollToSection('features')} style={footerLinkButton}>Fonctionnalites</button>
              <button onClick={() => scrollToSection('contact')} style={footerLinkButton}>Contact</button>
            </div>
          </div>

          <div>
            <h3 style={footerTitleStyle}>Acces Securises</h3>
            <div style={footerLinkListStyle}>
              <button onClick={() => router.push('/login')} style={footerLinkButton}>Portail Client</button>
              <button onClick={() => router.push('/hq')} style={footerHqButton}>Acces Maison Mere</button>
              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Reserve au staff</p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          © 2026 Kipilote. Tous droits reserves.
        </div>
      </footer>

      <style jsx>{`
        .contact-input,
        .contact-textarea {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .contact-input:focus,
        .contact-textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
        }
      `}</style>
    </div>
  );
}

// STYLES
const navLinkStyle = { background: 'none', border: 'none', fontWeight: 700, color: '#64748b', cursor: 'pointer', fontSize: '0.9rem' };
const btnPrimarySmall = { background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' };
const btnDarkLarge = { background: '#0f172a', color: 'white', border: 'none', padding: '18px 35px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' };
const btnLightLarge = { background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', padding: '18px 35px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' };

const priceCard = { background: 'white', padding: '40px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' as const, position: 'relative' as const };
const priceTitle = { fontSize: '1.1rem', fontWeight: 800, color: '#64748b', marginBottom: '15px' };
const priceValue = { fontSize: '3.5rem', fontWeight: 950, marginBottom: '25px' };
const priceMonth = { fontSize: '1rem', color: '#94a3b8', fontWeight: 600 };
const featureList = { listStyle: 'none', padding: 0, marginBottom: '35px', textAlign: 'left' as const };
const featureItem = { padding: '10px 0', fontSize: '0.9rem', color: '#475569', borderBottom: '1px solid #f8fafc' };
const btnPrice = { width: '100%', background: '#0f172a', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' };
const badgePro = { position: 'absolute' as any, top: '-15px', left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 900 };

const contactFormStyle = { background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', display: 'flex', flexDirection: 'column' as const, gap: '14px' };
const contactGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' };
const contactInputStyle = { border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', fontSize: '0.95rem', color: '#0f172a', width: '100%' };
const contactTextareaStyle = { border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', fontSize: '0.95rem', color: '#0f172a', width: '100%', resize: 'vertical' as const, fontFamily: 'inherit' };
const contactSubmitStyle = { alignSelf: 'flex-start' as const, background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' };

const footerTitleStyle = { margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' };
const footerLinkListStyle = { display: 'flex', flexDirection: 'column' as const, gap: '8px', alignItems: 'flex-start' as const };
const footerLinkButton = { background: 'none', border: 'none', padding: 0, color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' as const };
const footerHqButton = { ...footerLinkButton, textDecoration: 'underline', textUnderlineOffset: '4px', fontWeight: 700 };
