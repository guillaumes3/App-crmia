"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getGlobalStats } from '../utils/stats'; // Import de l'utilitaire

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    setStats(getGlobalStats());
  }, []);

  if (!stats) return null;

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', flex: 1 };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR UNIFIÉE */}
      <aside style={{ width: '240px', background: '#1e293b', color: 'white', padding: '1.5rem', position: 'fixed', height: '100vh' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem' }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
        <nav>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontWeight: 600 }}>📊 Pilotage Global</div>
          <Link href="/articles" style={{ display: 'block', padding: '10px', color: '#94a3b8', textDecoration: 'none', marginTop: '5px' }}>📦 Inventaire</Link>
          <button onClick={() => window.location.assign('/login')} style={{ marginTop: '50px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Déconnexion</button>
        </nav>
      </aside>

      {/* CONTENU DASHBOARD */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '30px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '25px' }}>Tableau de bord de pilotage</h1>

        {/* CHIFFRES CLÉS DYNAMIQUES */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={cardStyle}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CA Global (TTC)</label>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#6366f1', marginTop: '5px' }}>{(stats.caAmazon + stats.caShopify).toLocaleString()} €</div>
          </div>
          <div style={cardStyle}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Commandes Totales</label>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', marginTop: '5px' }}>{stats.ventesTotales}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Amz: {stats.caAmazon.toLocaleString()}€ | Shp: {stats.caShopify.toLocaleString()}€</div>
          </div>
          <div style={cardStyle}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Articles en Rupture</label>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', marginTop: '5px' }}>{stats.alertes}</div>
            <Link href="/articles" style={{ fontSize: '0.7rem', color: '#6366f1', textDecoration: 'none' }}>Gérer le stock →</Link>
          </div>
        </div>

        {/* RÉPARTITION CANAUX */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ ...cardStyle, flex: 2 }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '15px' }}>Répartition du CA par Marketplace</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '100px' }}>
               <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FF9900' }}>{((stats.caAmazon / (stats.caAmazon + stats.caShopify || 1)) * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: '0.7rem' }}>Amazon</div>
               </div>
               <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#95BF47' }}>{((stats.caShopify / (stats.caAmazon + stats.caShopify || 1)) * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: '0.7rem' }}>Shopify</div>
               </div>
            </div>
          </div>
          <div style={{ ...cardStyle, background: '#1e293b', color: 'white' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Valeur du Stock</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{stats.stockTotal} unités</div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Prêt pour expédition immédiate.</p>
          </div>
        </div>
      </main>
    </div>
  );
}