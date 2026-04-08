"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function Parametres() {
  // Notre "base de données" temporaire pour les clés
  const [apiKeys, setApiKeys] = useState([
    { platform: 'Shopify', key: 'shpat_8a7b6c5d4e3f2g1h' }
  ]);
  const [newPlatform, setNewPlatform] = useState("Amazon");
  const [newKey, setNewKey] = useState("");

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    setApiKeys([...apiKeys, { platform: newPlatform, key: newKey }]);
    setNewKey(""); // On vide le champ
  };

  const handleRemoveKey = (indexToRemove: number) => {
    setApiKeys(apiKeys.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo" style={{ color: 'white', marginBottom: '2rem' }}>CRM<span style={{ color: 'var(--primary)' }}>AI</span></div>
        <ul className="nav-menu">
          <li><Link href="/dashboard">📊 Vue d'ensemble</Link></li>
          <li><Link href="/ajouter-produit">📦 Nouvelle Fiche Produit</Link></li>
          <li><Link href="/parametres" className="active">⚙️ Paramètres</Link></li>
          <li style={{ marginTop: '2rem' }}><Link href="/" style={{ color: '#f87171' }}>🚪 Se déconnecter</Link></li>
        </ul>
      </aside>

      <main className="main-content">
        <h1 style={{ marginBottom: '2rem' }}>Paramètres de l'entreprise</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="stat-card">
              <h3 style={{ marginBottom: '1rem' }}>Profil</h3>
              <div style={{ marginBottom: '1rem' }}><label style={{ fontWeight: 600 }}>Nom</label><input type="text" defaultValue="Entreprise XYZ" style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} /></div>
              <button className="btn btn-outline" style={{ border: '2px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600 }}>Mettre à jour</button>
            </div>

            <div className="stat-card">
              <h3 style={{ marginBottom: '1rem' }}>🔌 Intégrations Marketplaces</h3>
              <form onSubmit={handleAddKey} style={{ background: 'var(--bg-light)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} style={{ padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px', flex: 1, background: 'white' }}>
                    <option value="Amazon">Amazon</option>
                    <option value="Shopify">Shopify</option>
                    <option value="eBay">eBay</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Votre clé secrète..." required style={{ flex: 2, padding: '0.8rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>➕ Ajouter</button>
                </div>
              </form>

              <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Connexions actives</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {apiKeys.length === 0 ? (
                  <li style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>Aucune connexion.</li>
                ) : (
                  apiKeys.map((item, index) => (
                    <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{item.platform}</div>
                        <div style={{ fontFamily: 'monospace', color: '#64748b', background: 'var(--bg-light)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', marginTop: '5px' }}>
                          {item.key.substring(0, 6)}••••••••••••
                        </div>
                      </div>
                      <button onClick={() => handleRemoveKey(index)} style={{ color: '#ef4444', background: '#fef2f2', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>🗑️ Retirer</button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}