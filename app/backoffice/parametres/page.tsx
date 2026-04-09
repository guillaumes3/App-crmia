"use client";
import { useState } from 'react';
import { getAccessLevel } from '../../utils/authGuard';

export default function ParametresPage() {
  // --- 1. ETATS ET DONNÉES ---
  const [user] = useState({ role: "Administrateur" }); // Change en "Commercial" pour tester la lecture seule
  const access = getAccessLevel(user.role, "parametres");

  const [collabs] = useState([
    { id: 1, nom: "Alice Martin", email: "alice@crm.com", profil: "Gestionnaire Stock" },
    { id: 2, nom: "Thomas Durand", email: "thomas@crm.com", profil: "Commercial" }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState<any>(null);

  // --- 2. ACTIONS ---
  const handleEditClick = (collab: any) => {
    setSelectedCollab(collab);
    setIsModalOpen(true);
  };

  const cardStyle = { 
    background: 'white', 
    padding: '25px', 
    borderRadius: '20px', 
    border: '1px solid #e2e8f0',
    opacity: access === "read" ? 0.8 : 1 // Effet visuel si lecture seule
  };

  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '25px' }}>
        Console d'administration 
        {access === "read" && <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '5px 12px', borderRadius: '10px', marginLeft: '15px', color: '#64748b' }}>Lecture seule</span>}
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
        
        {/* BLOC : GESTION DE L'ÉQUIPE */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '20px' }}>👥 Gestion de l'équipe</h3>
          
          {/* Formulaire d'invitation (Verrouillé si read-only) */}
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', pointerEvents: access === "read" ? 'none' : 'auto', opacity: access === "read" ? 0.6 : 1 }}>
             <input disabled={access === "read"} placeholder="Nom complet" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '10px' }} />
             <button disabled={access === "read"} style={{ width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700 }}>
                Inviter le collaborateur
             </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {collabs.map(collab => (
              <div key={collab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{collab.nom}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700 }}>{collab.profil}</div>
                </div>
                {/* On n'affiche le bouton modifier QUE si on n'est pas en lecture seule */}
                {access === "full" && (
                  <button onClick={() => handleEditClick(collab)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Modifier</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BLOC : INTÉGRATIONS API */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '20px' }}>🔌 Intégrations API</h3>
          <div style={{ padding: '20px', background: access === "read" ? '#f8fafc' : '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', color: access === "read" ? '#64748b' : '#92400e', fontSize: '0.85rem' }}>
            {access === "read" 
              ? "ℹ️ Vous n'avez pas les droits pour modifier les clés API." 
              : "⚠️ Les clés Shopify et Amazon sont synchronisées. Toute modification impactera le stock."}
          </div>
        </div>
      </div>

      {/* --- MODAL (POP-UP) --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: 'white', width: '400px', borderRadius: '20px', padding: '30px', boxShadow: '0 20px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginBottom: '15px' }}>Modifier {selectedCollab?.nom}</h2>
            <select style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <option>Commercial</option>
              <option>Gestionnaire Stock</option>
              <option>Administrateur</option>
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700 }}>Annuler</button>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}