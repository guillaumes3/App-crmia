"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function ParametresPage() {
  const [emailCollab, setEmailCollab] = useState("");
  const [nomCollab, setNomCollab] = useState("");
  const [role, setRole] = useState("Commercial");
  const [currentOrgId, setCurrentOrgId] = useState("");

  // Au chargement, on récupère l'ID de l'entreprise de l'utilisateur connecté
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentOrgId(session.user.user_metadata.organisation_id);
    };
    getSession();
  }, []);

  const inviterCollaborateur = async () => {
    if (!currentOrgId) return alert("Session expirée");

    const { error } = await supabase.auth.signUp({
      email: emailCollab,
      password: "ChangeMe123!", // Mot de passe temporaire
      options: {
        data: { 
          organisation_id: currentOrgId, // <--- On le lie à la MÊME boîte !
          role: role,
          nom: nomCollab
        }
      }
    });

    if (error) alert(error.message);
    else {
      alert(`Invitation envoyée à ${nomCollab} !`);
      setEmailCollab(""); setNomCollab("");
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1>Paramètres de l'entreprise</h1>
      <div style={{ background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <h3>👥 Ajouter un collaborateur à votre équipe</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <input placeholder="Nom du collaborateur" value={nomCollab} onChange={e => setNomCollab(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
          <input placeholder="Email professionnel" value={emailCollab} onChange={e => setEmailCollab(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <option>Commercial</option>
            <option>Gestionnaire Stock</option>
          </select>
          <button onClick={inviterCollaborateur} style={{ background: '#6366f1', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            Inscrire le collaborateur
          </button>
        </div>
      </div>
    </div>
  );
}