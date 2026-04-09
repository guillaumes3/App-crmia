"use client";
export default function ProfilPage() {
  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '25px' }}>Mon Profil de Travail</h1>
      
      <div style={{ background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>GS</div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Guillaume S.</div>
            <div style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.8rem' }}>Administrateur</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>ADRESSE EMAIL</label>
            <input type="email" defaultValue="guillaume@entreprise.com" style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>CHANGER LE MOT DE PASSE</label>
            <input type="password" placeholder="••••••••" style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginTop: '10px' }}>
            <input type="checkbox" defaultChecked style={{ marginTop: '4px' }} />
            <span style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>Recevoir les alertes de stock critique et les rapports hebdomadaires par email</span>
          </div>

          <button style={{ background: '#6366f1', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>
            Sauvegarder les modifications
          </button>
        </div>
      </div>
    </div>
  );
}