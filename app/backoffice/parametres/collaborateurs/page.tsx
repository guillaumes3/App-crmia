"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';

export default function CollaborateursPage() {
  const [collabList, setCollabList] = useState<any[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<any | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('organisation_id', session.user.user_metadata.organisation_id);
      if (data) setCollabList(data);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdate = async () => {
    if (!selectedCollab) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        nom: selectedCollab.nom,
        prenom: selectedCollab.prenom,
        equipe: selectedCollab.equipe,
        role: selectedCollab.role
      })
      .eq('id', selectedCollab.id);

    if (error) alert("Erreur : " + error.message);
    else {
      alert("Enregistré !");
      setSelectedCollab(null);
      loadData();
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Liste à gauche */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>Membres de l'organisation</h2>
        {collabList.length === 0 ? (
           <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>Aucun membre (table vide).</p>
        ) : (
          collabList.map(c => (
            <div key={c.id} style={itemStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{c.prenom || ''} {c.nom || 'Sans nom'}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.role || 'Collaborateur'}</div>
              </div>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setActiveMenu(activeMenu === c.id ? null : c.id)} style={burgerBtn}>⋮</button>
                {activeMenu === c.id && (
                  <div style={dropdownStyle}>
                    <div style={dropdownItem} onClick={() => { setSelectedCollab(c); setActiveMenu(null); }}>Modifier</div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Édition à droite */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>Détails du profil</h2>
        {selectedCollab ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input style={inS} value={selectedCollab.prenom || ''} onChange={e => setSelectedCollab({...selectedCollab, prenom: e.target.value})} placeholder="Prénom" />
            <input style={inS} value={selectedCollab.nom || ''} onChange={e => setSelectedCollab({...selectedCollab, nom: e.target.value})} placeholder="Nom" />
            <input style={inS} value={selectedCollab.equipe || ''} onChange={e => setSelectedCollab({...selectedCollab, equipe: e.target.value})} placeholder="Équipe" />
            <button onClick={handleUpdate} disabled={loading} style={btnStyle}>
              {loading ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>Sélectionnez "Modifier" via le menu ⋮</div>
        )}
      </div>
    </div>
  );
}

// Styles
const cardStyle = { background: 'white', padding: '25px', borderRadius: '15px', border: '1px solid #e2e8f0' };
const titleStyle = { fontSize: '1rem', fontWeight: 900, marginBottom: '20px' };
const itemStyle = { display: 'flex', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px' };
const burgerBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' };
const dropdownStyle = { position: 'absolute' as any, right: 0, top: '25px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', zIndex: 10, minWidth: '100px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const dropdownItem = { padding: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 };
const inS = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' };
const btnStyle = { background: '#6366f1', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' };