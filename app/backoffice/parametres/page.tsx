"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function ParametresPage() {
  const [activeModal, setActiveModal] = useState<null | 'tva' | 'categories' | 'equipe'>(null);
  const [orgId, setOrgId] = useState("");
  
  const [collabList, setCollabList] = useState<any[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<any>(null);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const id = session.user.user_metadata.organisation_id;
      setOrgId(id);
      const { data: profs } = await supabase.from('profiles').select('*').eq('organisation_id', id);
      if (profs) setCollabList(profs);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeModal]);

  const saveCollab = async () => {
    if (!selectedCollab.nom || !selectedCollab.email) return alert("Nom et Email requis");
    const isNew = !selectedCollab.id;
    let error;

    if (isNew) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: selectedCollab.email,
        password: "ChangeMe123!",
        options: { data: { ...selectedCollab, organisation_id: orgId } }
      });
      error = signUpError;
    } else {
      const { error: upError } = await supabase.from('profiles').update(selectedCollab).eq('id', selectedCollab.id);
      error = upError;
    }

    if (!error) {
      alert(isNew ? "Invitation envoyée !" : "Fiche mise à jour !");
      setSelectedCollab(null);
      loadData();
    }
  };

  // --- NOUVELLE FONCTION : SUPPRIMER ---
  const deleteCollab = async () => {
    if (!selectedCollab.id) return;
    
    const confirmDelete = confirm(`Êtes-vous sûr de vouloir retirer ${selectedCollab.nom} de l'équipe ?`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', selectedCollab.id);

    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
    } else {
      alert("Collaborateur retiré avec succès.");
      setSelectedCollab(null);
      loadData();
    }
  };

  return (
    <div className="page-container">
      {/* ... Reste de ton code (Header, Cartes de paramètres) ... */}

      {selectedCollab && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '30px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 900 }}>Fiche Collaborateur</h2>
              <button onClick={() => setSelectedCollab(null)} style={{ background: '#f1f5f9', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Fermer</button>
            </div>

            <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={labelS}>NOM COMPLET</label>
                  <input style={inputS} value={selectedCollab.nom} onChange={e => setSelectedCollab({...selectedCollab, nom: e.target.value})} />
                  
                  <label style={labelS}>EMAIL PROFESSIONNEL</label>
                  {/* CASE DÉBLOQUÉE ICI */}
                  <input style={inputS} value={selectedCollab.email} onChange={e => setSelectedCollab({...selectedCollab, email: e.target.value})} />
                </div>
                <div>
                  <label style={labelS}>RÔLE KIPILOTE</label>
                  <select style={inputS} value={selectedCollab.role} onChange={e => setSelectedCollab({...selectedCollab, role: e.target.value})}>
                    <option>Commercial</option>
                    <option>Gestionnaire Stock</option>
                    <option>Administrateur</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={saveCollab} style={{ ...saveBtn, flex: 2 }}>Mettre à jour</button>
                
                {/* BOUTON SUPPRIMER (Apparaît seulement si le collaborateur existe déjà) */}
                {selectedCollab.id && (
                  <button onClick={deleteCollab} style={deleteBtnStyle}>Supprimer</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- AJOUTS STYLES ---
const labelS = { display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as const };
const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '15px', outline: 'none' };
const saveBtn = { background: '#0f172a', color: 'white', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' };
const deleteBtnStyle = { background: '#fee2e2', color: '#ef4444', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', flex: 1 };