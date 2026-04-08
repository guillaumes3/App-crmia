"use client";
import React, { useState, useEffect } from 'react';

export default function DetailArticle({ params }: { params: Promise<{ id: string }> }) {
  // On déballe l'ID avec React.use pour Next.js 15
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  const [p, setP] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- ÉTATS ÉDITABLES ---
  const [prixAchatHT, setPrixAchatHT] = useState(0);
  const [margeAmz, setMargeAmz] = useState(20);
  const [margeShp, setMargeShp] = useState(15);
  const [stockTotal, setStockTotal] = useState(0);
  const [emplacement, setEmplacement] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('mes_produits') || '[]');
    const found = data.find((item: any) => item.id === id);
    if (found) {
      setP(found);
      setPrixAchatHT(found.prixAchat || 0);
      setStockTotal(found.stock || 0);
      setEmplacement(found.emplacement || "");
      setDescription(found.description || "");
    }
  }, [id]);

  // --- CALCULS ---
  const tvaFacteur = 1.20;
  const pVenteAmzTTC = (prixAchatHT + margeAmz) * tvaFacteur;
  const pVenteShpTTC = (prixAchatHT + margeShp) * tvaFacteur;
  const margePctAmz = (margeAmz / (prixAchatHT + margeAmz)) * 100 || 0;
  const margePctShp = (margeShp / (prixAchatHT + margeShp)) * 100 || 0;
  const caPotentiel = stockTotal * ((pVenteAmzTTC + pVenteShpTTC) / 2);

  if (!p) return <div style={{padding:'20px', color:'#64748b'}}>Chargement du produit {id}...</div>;

  // --- STYLES COMPACTS (One-Glance) ---
  const cardStyle = { background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' };
  const labelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' as const };
  const inputStyle = { width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: '700', fontSize: '0.85rem' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR - NAVIGATION FORCÉE */}
      <aside style={{ width: '220px', background: '#1e293b', color: 'white', padding: '1.5rem', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '2rem', color: 'white' }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
        
        <button 
          onClick={() => window.location.assign('/articles')} 
          style={{ 
            width: '100%', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', 
            padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textAlign: 'left'
          }}
        >
          ← Retour Inventaire
        </button>
      </aside>

      <main style={{ marginLeft: '220px', flex: 1, padding: '20px' }}>
        
        {/* HEADER COMPACT */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Pilotage : {p.nom}</h1>
          <button style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
            Mettre à jour sur les Marketplaces
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '15px' }}>
          
          {/* COLONNE GAUCHE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* CARD FINANCE */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem' }}>💰</span>
                <h3 style={{ fontSize: '0.8rem', margin: 0 }}>Structure de prix</h3>
              </div>
              <label style={labelStyle}>Prix d'achat unitaire (HT)</label>
              <input type="number" value={prixAchatHT} onChange={(e)=>setPrixAchatHT(Number(e.target.value))} style={inputStyle} />
              <div style={{ marginTop: '10px', color: '#10b981', fontWeight: 700, fontSize: '0.8rem' }}>
                Marge Globale : {((margePctAmz + margePctShp)/2).toFixed(1)}%
              </div>
            </div>

            {/* CARD STOCK & VALEUR */}
            <div style={{ ...cardStyle, background: '#1e293b', color: 'white', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem' }}>📦</span>
                <h3 style={{ fontSize: '0.8rem', margin: 0, color: '#6366f1' }}>Stock & Valeur</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{stockTotal} <span style={{fontSize:'0.7rem', color:'#94a3b8'}}>U.</span></div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{caPotentiel.toLocaleString()}€ (CA Pot.)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <label style={{...labelStyle, color:'#6366f1'}}>CA POTENTIEL (TTC)</label>
                   <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{caPotentiel.toLocaleString()} €</div>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#94a3b8' }}>📍 {emplacement || 'Localisation non définie'}</div>
            </div>
          </div>

          {/* COLONNE DROITE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* CARD PERFORMANCE */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem' }}>📈</span>
                <h3 style={{ fontSize: '0.8rem', margin: 0 }}>Performance par Canal</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                <span style={{color:'#475569'}}>Amazon (Ventes : 142)</span>
                <span style={{ fontWeight: 800, color: '#10b981' }}>8 518,58 €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.8rem' }}>
                <span style={{color:'#475569'}}>Shopify (Ventes : 64)</span>
                <span style={{ fontWeight: 800, color: '#10b981' }}>3 839,36 €</span>
              </div>
            </div>

            {/* SECTION IA & DESCRIPTION (ALIGNÉES) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem' }}>📝</span>
                  <h3 style={{ fontSize: '0.8rem', margin: 0 }}>Descriptif & SEA</h3>
                </div>
                <label style={labelStyle}>Description commerciale et SEA</label>
                <textarea 
                  value={description} 
                  onChange={(e)=>setDescription(e.target.value)}
                  style={{ width: '100%', height: '70px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', fontSize: '0.75rem', color: '#475569', resize: 'none' }} 
                />
              </div>

              <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '15px', borderRadius: '15px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '5px' }}>✨ Assistant IA</div>
                <p style={{ fontSize: '0.6rem', marginBottom: '10px', opacity: 0.9 }}>Générez un descriptif optimisé pour le SEA Amazon et Shopify.</p>
                <button 
                  onClick={() => setDescription("Optimisation IA terminée pour " + p.nom)}
                  style={{ width: '100%', padding: '8px', background: 'white', color: '#6366f1', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.7rem' }}
                >
                  🪄 Générer ma fiche
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}