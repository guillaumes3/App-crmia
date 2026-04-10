"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';

// Dictionnaire de traduction pour les clés de la base de données
const traductions: Record<string, string> = {
  can_view_stock: "Voir le stock",
  can_edit_stock: "Modifier le stock",
  can_view_sales: "Consulter les ventes",
  can_create_sales: "Enregistrer des ventes",
  can_view_dashboard: "Accéder au tableau de bord",
  can_manage_users: "Gérer les utilisateurs"
};

interface PermissionsState {
  can_view_stock: boolean;
  can_edit_stock: boolean;
  can_view_sales: boolean;
  can_create_sales: boolean;
  can_view_dashboard: boolean;
  can_manage_users: boolean;
}

export default function GestionRoles() {
  const [nomRole, setNomRole] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionsState>({
    can_view_stock: true,
    can_edit_stock: false,
    can_view_sales: true,
    can_create_sales: true,
    can_view_dashboard: false,
    can_manage_users: false
  });

  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.organisation_id) {
        setOrgId(user.user_metadata.organisation_id);
      }
    };
    getSession();
  }, []);

  const togglePermission = (key: keyof PermissionsState) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enregistrerRole = async () => {
    if (!orgId) return alert("Erreur : Organisation non identifiée");
    if (!nomRole) return alert("Veuillez donner un nom au rôle");

    const { error } = await supabase
      .from('roles_personnalises')
      .insert([{
        nom_role: nomRole,
        organisation_id: orgId,
        ...permissions
      }]);

    if (error) alert(error.message);
    else {
      alert("Rôle créé avec succès");
      setNomRole("");
    }
  };

  return (
    <div style={containerStyle}>
      {/* Bouton de retour rapide si le menu layout ne suffit pas */}
      <Link href="/backoffice/parametres" style={backLinkStyle}>
        Retour aux paramètres
      </Link>

      <h1 style={{ fontWeight: 900, fontSize: '1.5rem', marginBottom: '10px' }}>
        Configuration des Rôles
      </h1>
      <p style={{ color: '#64748b', marginBottom: '20px' }}>
        Définissez les accès personnalisés pour votre équipe.
      </p>

      <div style={cardStyle}>
        <label style={labelStyle}>Nom du rôle</label>
        <input 
          placeholder="Exemple: Magasinier, Commercial Junior..." 
          value={nomRole}
          onChange={(e) => setNomRole(e.target.value)}
          style={inputStyle}
        />

        <div style={gridPermissions}>
          {(Object.keys(permissions) as Array<keyof PermissionsState>).map((perm) => (
            <div key={perm} style={permLine}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {traductions[perm]}
              </span>
              <input 
                type="checkbox" 
                checked={permissions[perm]} 
                onChange={() => togglePermission(perm)}
                style={checkboxStyle}
              />
            </div>
          ))}
        </div>

        <button onClick={enregistrerRole} style={btnStyle}>
          Enregistrer le rôle
        </button>
      </div>
    </div>
  );
}

// Styles cohérents avec ton interface Kipilote
const containerStyle = { animation: 'fadeIn 0.3s ease-in-out' };
const backLinkStyle = { color: '#6366f1', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '15px' };
const cardStyle = { background: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '600px' };
const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' as any };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '25px', outline: 'none', fontSize: '1rem', boxSizing: 'border-box' as any };
const gridPermissions = { display: 'grid', gap: '10px', marginBottom: '30px' };
const permLine = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' };
const checkboxStyle = { width: '20px', height: '20px', cursor: 'pointer', accentColor: '#6366f1' };
const btnStyle = { background: '#6366f1', color: 'white', border: 'none', padding: '14px 25px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '0.9rem' };