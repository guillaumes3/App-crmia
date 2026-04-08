"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ListeArticles() {
  const [produits, setProduits] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // État du formulaire
  const [form, setForm] = useState({
    nom: "",
    prixAchat: 0,
    stock: 0,
    emplacement: "",
    description: ""
  });

  // Charger les produits depuis le localStorage au montage
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('mes_produits') || '[]');
    setProduits(data);
  }, []);

  // Sauvegarde d'un nouveau produit
  const handleSave = () => {
    if (!form.nom) return alert("Le nom du produit est obligatoire.");

    const existing = JSON.parse(localStorage.getItem('mes_produits') || '[]');
    
    // Création d'un ID unique basé sur le nom et le timestamp
    const newId = form.nom.toLowerCase().trim().replace(/\s+/g, '-') + '-' + Date.now();
    
    const newProduct = { 
      ...form, 
      id: newId,
      stats: { 
        amazon: { ventes: 0, sessions: 0 }, 
        shopify: { ventes: 0, sessions: 0 } 
      } 
    };

    const updatedList = [...existing, newProduct];
    localStorage.setItem('mes_produits', JSON.stringify(updatedList));
    setProduits(updatedList);
    
    // Fermeture et réinitialisation
    setIsModalOpen(false);
    setForm({ nom: "", prixAchat: 0, stock: 0, emplacement: "", description: "" });
  };

  // Styles
  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#1e293b',
    fontWeight: '600'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 800,
    color: '#64748b',
    marginBottom: '5px',
    textTransform: 'uppercase' as const
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '240px', background: '#1e293b', color: 'white', padding: '1.5rem', position: 'fixed', height: '100vh' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem' }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
        <nav>
          <button 
            onClick={() => window.location.assign('/dashboard')}
            style={{ width: '100%', background: 'none', border: 'none', color: '#94a3b8', textAlign: 'left', padding: '10px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            📊 Dashboard
          </button>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontWeight: 600, marginTop: '5px' }}>
            📦 Inventaire
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Gestion des Articles ({produits.length})</h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
          >
            + Ajouter un article
          </button>
        </div>

        {/* TABLEAU DES PRODUITS */}
        <div style={{ background: 'white', borderRadius: '15px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '15px', fontSize: '0.8rem', color: '#64748b' }}>PRODUIT</th>
                <th style={{ padding: '15px', fontSize: '0.8rem', color: '#64748b' }}>STOCK TOTAL</th>
                <th style={{ padding: '15px', fontSize: '0.8rem', color: '#64748b' }}>EMPLACEMENT</th>
                <th style={{ padding: '15px', fontSize: '0.8rem', color: '#64748b' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '15px', fontWeight: 700, color: '#1e293b' }}>{p.nom}</td>
                  <td style={{ padding: '15px', color: '#475569' }}>{p.stock} unités</td>
                  <td style={{ padding: '15px', color: '#64748b' }}>{p.emplacement || 'Non défini'}</td>
                  <td style={{ padding: '15px' }}>
                    <Link href={`/articles/${p.id}`} style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
                      Gérer la fiche →
                    </Link>
                  </td>
                </tr>
              ))}
              {produits.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    Aucun article trouvé. Cliquez sur le bouton pour en ajouter un.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL POP-UP */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '30px', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            {/* CROIX DE FERMETURE */}
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}
            >
              ✕
            </button>

            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', color: '#1e293b' }}>🚀 Ajouter un produit</h2>
            
            <label style={labelStyle}>Nom de l'article</label>
            <input 
              style={inputStyle} 
              type="text" 
              placeholder="ex: Montre Connectée Pro" 
              onChange={(e) => setForm({...form, nom: e.target.value})} 
            />
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prix Achat HT (€)</label>
                <input 
                  style={inputStyle} 
                  type="number" 
                  placeholder="0.00" 
                  onChange={(e) => setForm({...form, prixAchat: Number(e.target.value)})} 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Stock Initial</label>
                <input 
                  style={inputStyle} 
                  type="number" 
                  placeholder="0" 
                  onChange={(e) => setForm({...form, stock: Number(e.target.value)})} 
                />
              </div>
            </div>

            <label style={labelStyle}>Emplacement stockage</label>
            <input 
              style={inputStyle} 
              type="text" 
              placeholder="ex: Rayon A-12" 
              onChange={(e) => setForm({...form, emplacement: e.target.value})} 
            />

            <label style={labelStyle}>Description SEA / SEO</label>
            <textarea 
              style={{ ...inputStyle, height: '80px', resize: 'none' }} 
              placeholder="Caractéristiques principales..." 
              onChange={(e) => setForm({...form, description: e.target.value})} 
            />

            <button 
              onClick={handleSave}
              style={{ width: '100%', padding: '14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', marginTop: '10px' }}
            >
              Enregistrer et synchroniser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}