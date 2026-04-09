"use client";
import React, { useState, useEffect } from 'react';

export default function DetailArticle({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const [p, setP] = useState<any>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('mes_produits') || '[]');
    const found = data.find((item: any) => item.id === id);
    if (found) { setP(found); setDescription(found.description || ""); }
  }, [id]);

  if (!p) return <div>Chargement...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Pilotage : {p.nom}</h1>
        <button onClick={() => window.location.assign('/backoffice/articles')} style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>← Retour</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>💰 FINANCE</h3>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Marge Globale : 27.9%</div>
          </div>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: 'white' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#6366f1', marginBottom: '10px' }}>📦 STOCK & VALEUR</h3>
            <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{p.stock} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>U.</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '15px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.85rem', marginBottom: '10px' }}>📝 DESCRIPTIF & SEA</h3>
              <textarea value={description} onChange={(e)=>setDescription(e.target.value)} style={{ width: '100%', height: '80px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '0.8rem' }} />
            </div>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '20px', borderRadius: '12px', color: 'white', textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', marginBottom: '10px' }}>✨ Assistant IA</h3>
              <button onClick={() => setDescription("Texte optimisé pour Amazon et Shopify...")} style={{ width: '100%', padding: '10px', background: 'white', color: '#6366f1', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.75rem' }}>🪄 Générer fiche</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}