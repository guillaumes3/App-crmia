"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState('collab');
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [newProfile, setNewProfile] = useState({
    nom: '',
    prenom: '',
    email: '',
    role: 'Commercial',
    equipe: 'Ventes',
    matricule: '',
    telephone: '',
    autorisations: 'Standard'
  });

  useEffect(() => {
    const getOrg = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setOrgId(session.user.user_metadata.organisation_id);
    };
    getOrg();
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: newProfile.email,
      password: "KipiloteTemp123!",
      options: {
        data: { 
          ...newProfile,
          organisation_id: orgId,
          nom_complet: `${newProfile.prenom} ${newProfile.nom}`
        }
      }
    });

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      alert("Profil cree avec succes.");
      setNewProfile({ nom: '', prenom: '', email: '', role: 'Commercial', equipe: 'Ventes', matricule: '', telephone: '', autorisations: 'Standard' });
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <h1 style={{ fontWeight: 900, marginBottom: '30px', fontSize: '2rem' }}>Configuration Kipilote</h1>

      <nav style={subNavBar}>
        <button onClick={() => setActiveTab('collab')} style={tabStyle(activeTab === 'collab')}>Collaborateurs</button>
        <button onClick={() => setActiveTab('taxes')} style={tabStyle(activeTab === 'taxes')}>Fiscalite</button>
        <button onClick={() => setActiveTab('cats')} style={tabStyle(activeTab === 'cats')}>Categories</button>
        <button onClick={() => setActiveTab('loc')} style={tabStyle(activeTab === 'loc')}>Emplacements</button>
      </nav>

      <div style={formCard}>
        <div style={{borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '30px'}}>
            <h2 style={{margin:0, fontSize: '1.2rem', fontWeight: 800}}>Enregistrement Collaborateur</h2>
            <p style={{margin: '5px 0 0 0', color: '#64748b', fontSize: '0.9rem'}}>Saisie des donnees administratives et acces systeme.</p>
        </div>

        <form onSubmit={handleCreateProfile}>
          <div style={grid3}>
            <div style={inputBox}>
              <label style={labelS}>Prenom</label>
              <input required style={inS} value={newProfile.prenom} onChange={e => setNewProfile({...newProfile, prenom: e.target.value})} placeholder="Ex: Jean" />
            </div>
            <div style={inputBox}>
              <label style={labelS}>Nom</label>
              <input required style={inS} value={newProfile.nom} onChange={e => setNewProfile({...newProfile, nom: e.target.value})} placeholder="Ex: Dupont" />
            </div>
            <div style={inputBox}>
              <label style={labelS}>Matricule</label>
              <input style={inS} value={newProfile.matricule} onChange={e => setNewProfile({...newProfile, matricule: e.target.value})} placeholder="ID-000" />
            </div>
          </div>

          <div style={grid2}>
            <div style={inputBox}>
              <label style={labelS}>Email</label>
              <input required type="email" style={inS} value={newProfile.email} onChange={e => setNewProfile({...newProfile, email: e.target.value})} />
            </div>
            <div style={inputBox}>
              <label style={labelS}>Telephone</label>
              <input style={inS} value={newProfile.telephone} onChange={e => setNewProfile({...newProfile, telephone: e.target.value})} />
            </div>
          </div>

          <div style={{...grid3, background: '#f8fafc', padding: '20px', borderRadius: '15px', marginTop: '10px'}}>
            <div style={inputBox}>
              <label style={labelS}>Role</label>
              <select style={inS} value={newProfile.role} onChange={e => setNewProfile({...newProfile, role: e.target.value})}>
                <option>Administrateur</option>
                <option>Gestionnaire Stock</option>
                <option>Commercial</option>
                <option>Logistique</option>
              </select>
            </div>
            <div style={inputBox}>
              <label style={labelS}>Equipe</label>
              <input style={inS} value={newProfile.equipe} onChange={e => setNewProfile({...newProfile, equipe: e.target.value})} />
            </div>
            <div style={inputBox}>
              <label style={labelS}>Autorisations</label>
              <select style={inS} value={newProfile.autorisations} onChange={e => setNewProfile({...newProfile, autorisations: e.target.value})}>
                <option>Acces Total</option>
                <option>Standard</option>
                <option>Lecture Seule</option>
              </select>
            </div>
          </div>

          <div style={{marginTop: '30px', display: 'flex', justifyContent: 'flex-end'}}>
             <button type="submit" disabled={loading} style={submitBtn}>
               {loading ? "Chargement..." : "Enregistrer le profil"}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// STYLES
const subNavBar = { display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '25px' };
const tabStyle = (active: boolean) => ({ background: active ? '#6366f1' : 'transparent', color: active ? 'white' : '#475569', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' });
const formCard = { background: 'white', padding: '40px', borderRadius: '25px', border: '1px solid #e2e8f0' };
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' };
const inputBox = { display: 'flex', flexDirection: 'column' as any };
const labelS = { fontSize: '0.7rem', fontWeight: 900, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any };
const inS = { padding: '12px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' };
const submitBtn = { background: '#6366f1', color: 'white', border: 'none', padding: '15px 35px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' };