"use client";
import { useEffect, useState } from 'react';
import { getGlobalStats } from '../../utils/stats';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    setStats(getGlobalStats());
  }, []);

  if (!stats) return <div style={{padding: '40px'}}>Initialisation du pilotage...</div>;

  const cardStyle = { background: 'white', padding: '25px', borderRadius: '15px', border: '1px solid #e2e8f0' };

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '25px', color: '#1e293b' }}>
        Tableau de bord de pilotage
      </h1>
      
      {/* GRILLE DE CHIFFRES CLÉS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={cardStyle}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px' }}>CA GLOBAL ESTIMÉ (TTC)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1', marginTop: '10px' }}>
            {(stats.caAmazon + stats.caShopify).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </div>
          <div style={{ marginTop: '15px', fontSize: '0.8rem', display: 'flex', gap: '10px' }}>
            <span style={{ color: '#FF9900' }}>● Amazon: {stats.caAmazon.toFixed(0)}€</span>
            <span style={{ color: '#95BF47' }}>● Shopify: {stats.caShopify.toFixed(0)}€</span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800 }}>UNITÉS VENDUES</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b', marginTop: '10px' }}>
            {stats.ventesTotales} <span style={{fontSize: '1rem', color: '#94a3b8'}}>commandes</span>
          </div>
          <div style={{ marginTop: '15px', height: '8px', background: '#f1f5f9', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: `${(stats.caAmazon / (stats.caAmazon + stats.caShopify || 1)) * 100}%`, background: '#FF9900' }}></div>
            <div style={{ flex: 1, background: '#95BF47' }}></div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800 }}>ÉTAT DES STOCKS</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: stats.alertes > 0 ? '#ef4444' : '#10b981', marginTop: '10px' }}>
            {stats.stockTotal} <span style={{fontSize: '1rem', color: '#94a3b8'}}>en main</span>
          </div>
          {stats.alertes > 0 ? (
             <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, marginTop: '15px' }}>⚠️ {stats.alertes} articles en rupture imminente</div>
          ) : (
             <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, marginTop: '15px' }}>✅ Niveaux de stock sains</div>
          )}
        </div>
      </div>

      {/* SECTION ANALYSE RAPIDE */}
      <div style={{ background: '#1e293b', padding: '30px', borderRadius: '20px', color: 'white' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Recommandation de l'IA</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '10px', maxWidth: '600px' }}>
            {stats.alertes > 0 
              ? `Attention, vous avez ${stats.alertes} produits dont le stock est critique. Nous vous conseillons de réapprovisionner pour éviter une baisse de votre Buy Box Amazon.`
              : "Vos performances sont stables sur les deux canaux. Aucune action urgente n'est requise aujourd'hui."}
          </p>
      </div>
    </div>
  );
}