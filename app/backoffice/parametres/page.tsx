"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function ParametresPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<{ category: string, action: string } | null>(null);
  const [orgId, setOrgId] = useState("");
  const [collabList, setCollabList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Etats pour les filtres de recherche
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterEquipe, setFilterEquipe] = useState("Toutes");

  // Etat pour le nouveau profil (Formulaire complet)
  const [newProfile, setNewProfile] = useState({
    nom: '', prenom: '', email: '', role: 'Commercial', 
    equipe: 'Ventes', matricule: '', telephone: '', autorisations: 'Standard'
  });

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const id = session.user.user_metadata.organisation_id;
      setOrgId(id);
      const { data: profs } = await supabase.from('profiles').select('*').eq('organisation_id', id);
      if (profs) setCollabList(profs);
    }
  };

  useEffect(() => { loadData(); }, [activeView]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: newProfile.email,
      password: "KipiloteTemp123!",
      options: {
        data: { ...newProfile, organisation_id: orgId, nom_complet: `${newProfile.prenom} ${newProfile.nom}` }
      }
    });
    if (error) alert("Erreur : " + error.message);
    else {
      alert("Profil cree avec succes.");
      setNewProfile({ nom: '', prenom: '', email: '', role: 'Commercial', equipe: 'Ventes', matricule: '', telephone: '', autorisations: 'Standard' });
      setActiveView({ category: 'collab', action: 'list' });
    }
    setLoading(false);
  };

  const filteredCollabs = collabList.filter(c => {
    const searchString = `${c.nom} ${c.prenom} ${c.matricule} ${c.email}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "Tous" || c.role === filterRole;
    const matchesEquipe = filterEquipe === "Toutes" || c.equipe === filterEquipe;
    return matchesSearch && matchesRole && matchesEquipe;
  });

  const menuConfig = [
    {
      id: 'collab', label: 'Collaborateurs',
      options: [
        { label: 'Liste des membres', action: 'list' },
        { label: 'Creer un profil complet', action: 'add' }
      ]
    },
    { id: 'taxes', label: 'Fiscalite', options: [{ label: 'Modifier la TVA', action: 'tva' }] },
    { id: 'cats', label: 'Categories', options: [{ label: 'Gerer les segments', action: 'list' }] },
    { id: 'loc', label: 'Emplacements', options: [{ label: 'Depots et Stockage', action: 'list' }] }
  ];

  return (
    <div className="page-container">
      <h1 style={{ fontWeight: 900, marginBottom: '25px', fontSize: '1.8rem' }}>Configuration Kipilote</h1>

      <nav style={subNavBar}>
        {menuConfig.map((menu) => (
          <div key={menu.id} style={{ position: 'relative' }}>
            <button onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)} style={menuButtonStyle(openMenu === menu.id)}>
              {menu.label} <span style={{fontSize: '0.6rem', marginLeft: '8px'}}>{openMenu === menu.id ? '▲' : '▼'}</span>
            </button>
            {openMenu === menu.id && (
              <div style={dropdownStyle}>
                {menu.options.map((opt, i) => (
                  <div key={i} style={dropdownItem} onClick={() => { setActiveView({ category: menu.id, action: opt.action }); setOpenMenu(null); }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div style={contentArea}>
        {/* VUE : LISTE DES MEMBRES */}
        {activeView?.category === 'collab' && activeView.action === 'list' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <h2 style={{margin:0, fontSize: '1.1rem', fontWeight: 800}}>Annuaire de l'equipe</h2>
              <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
            </div>
            <div style={filterPanel}>
              <div style={{flex: 2}}>
                <label style={labelS}>Recherche multi-critere</label>
                <input style={inS} placeholder="Nom, prenom, matricule..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{flex: 1}}>
                <label style={labelS}>Role</label>
                <select style={inS} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                  <option>Tous</option><option>Administrateur</option><option>Gestionnaire Stock</option><option>Commercial</option>
                </select>
              </div>
              <div style={{display:'flex', alignItems:'flex-end'}}>
                <button style={resetBtn} onClick={() => {setSearchTerm(""); setFilterRole("Tous"); setFilterEquipe("Toutes");}}>Voir tout</button>
              </div>
            </div>
            <table style={tableS}>
              <thead>
                <tr style={thRow}>
                  <th style={thS}>Matricule</th><th style={thS}>Nom Complet</th><th style={thS}>Email</th><th style={thS}>Equipe</th><th style={thS}>Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollabs.map((c) => (
                  <tr key={c.id} style={trRow}>
                    <td style={tdS}>{c.matricule || '-'}</td>
                    <td style={tdS}><strong>{c.prenom} {c.nom}</strong></td>
                    <td style={tdS}>{c.email}</td>
                    <td style={tdS}>{c.equipe || 'N/A'}</td>
                    <td style={tdS}><span style={roleTag}>{c.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VUE : FORMULAIRE DE CREATION COMPLET */}
        {activeView?.category === 'collab' && activeView.action === 'add' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <h2 style={{margin:0, fontSize: '1.1rem', fontWeight: 800}}>Nouveau Profil Collaborateur</h2>
              <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
            </div>
            <form onSubmit={handleCreateProfile}>
              <div style={grid3}>
                <div style={inputBox}><label style={labelS}>Prenom</label>
                  <input style={inS} value={newProfile.prenom} onChange={e => setNewProfile({...newProfile, prenom: e.target.value})} required />
                </div>
                <div style={inputBox}><label style={labelS}>Nom</label>
                  <input style={inS} value={newProfile.nom} onChange={e => setNewProfile({...newProfile, nom: e.target.value})} required />
                </div>
                <div style={inputBox}><label style={labelS}>Matricule</label>
                  <input style={inS} value={newProfile.matricule} onChange={e => setNewProfile({...newProfile, matricule: e.target.value})} />
                </div>
              </div>
              <div style={grid2}>
                <div style={inputBox}><label style={labelS}>Email</label>
                  <input style={inS} type="email" value={newProfile.email} onChange={e => setNewProfile({...newProfile, email: e.target.value})} required />
                </div>
                <div style={inputBox}><label style={labelS}>Telephone</label>
                  <input style={inS} value={newProfile.telephone} onChange={e => setNewProfile({...newProfile, telephone: e.target.value})} />
                </div>
              </div>
              <div style={grid3}>
                <div style={inputBox}>
                  <label style={labelS}>Role</label>
                  <select style={inS} value={newProfile.role} onChange={e => setNewProfile({...newProfile, role: e.target.value})}>
                    <option>Administrateur</option><option>Gestionnaire Stock</option><option>Commercial</option><option>Logistique</option>
                  </select>
                </div>
                <div style={inputBox}><label style={labelS}>Equipe</label>
                  <input style={inS} value={newProfile.equipe} onChange={e => setNewProfile({...newProfile, equipe: e.target.value})} />
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Autorisations</label>
                  <select style={inS} value={newProfile.autorisations} onChange={e => setNewProfile({...newProfile, autorisations: e.target.value})}>
                    <option>Standard</option><option>Acces Total</option><option>Lecture Seule</option>
                  </select>
                </div>
              </div>
              <div style={{marginTop: '25px', display: 'flex', justifyContent: 'flex-end'}}>
                <button type="submit" disabled={loading} style={submitBtn}>{loading ? "Enregistrement..." : "Enregistrer le profil"}</button>
              </div>
            </form>
          </div>
        )}

        {!activeView && (
          <div style={emptyState}><p style={{color: '#64748b'}}>Selectionnez une action dans le menu pour commencer.</p></div>
        )}
      </div>
    </div>
  );
}

// STYLES
const subNavBar = { display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '25px', position: 'relative' as any };
const menuButtonStyle = (active: boolean) => ({ background: active ? '#f1f5f9' : 'transparent', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center' });
const dropdownStyle = { position: 'absolute' as any, top: '50px', left: 0, background: 'white', minWidth: '220px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100 };
const dropdownItem = { padding: '12px 16px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' };
const contentArea = { minHeight: '400px' };
const viewCard = { background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' };
const closeBtn = { background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' };
const filterPanel = { display: 'flex', gap: '15px', background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px' };
const labelS = { fontSize: '0.65rem', fontWeight: 900, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' as any };
const inS = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', width: '100%', background: 'white' };
const resetBtn = { background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' };
const tableS = { width: '100%', borderCollapse: 'collapse' as any };
const thRow = { textAlign: 'left' as any, borderBottom: '2px solid #f1f5f9' };
const thS = { padding: '15px 10px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 };
const tdS = { padding: '15px 10px', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' };
const trRow = { transition: '0.2s' };
const roleTag = { background: '#e0e7ff', color: '#6366f1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 };
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '15px' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' };
const inputBox = { display: 'flex', flexDirection: 'column' as any };
const submitBtn = { background: '#0f172a', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' };
const emptyState = { textAlign: 'center' as any, padding: '100px 0', border: '2px dashed #e2e8f0', borderRadius: '20px' };