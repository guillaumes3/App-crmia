"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";

type CollaborateurRow = {
  id: string;
  organisation_id?: string | null;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  equipe?: string | null;
  role?: string | null;
  must_change_password?: boolean;
};

type CreateCollaborateurForm = {
  prenom: string;
  nom: string;
  email: string;
  role: string;
  password: string;
};

const defaultCreateForm: CreateCollaborateurForm = {
  prenom: "",
  nom: "",
  email: "",
  role: "Collaborateur",
  password: "",
};

export default function CollaborateursPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [collabList, setCollabList] = useState<CollaborateurRow[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<CollaborateurRow | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCollaborateurForm>(defaultCreateForm);
  const [loading, setLoading] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const generateTempPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreateForm(prev => ({ ...prev, password }));
  };

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || isKipiloteStaff(session.user)) return;

    const sessionOrgId = getOrganisationId(session.user);
    if (!sessionOrgId) return;

    setOrgId(sessionOrgId);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("organisation_id", sessionOrgId)
      .order("prenom", { ascending: true });

    if (data) setCollabList(data as CollaborateurRow[]);
  };

  useEffect(() => { void loadData(); }, []);

  const handleCreate = async () => {
    if (!orgId) return alert("Organisation introuvable.");
    if (!createForm.email || !createForm.password) return alert("Email et mot de passe requis.");
    if (createForm.password.length < 6) return alert("Le mot de passe doit faire au moins 6 caractères.");

    const normalizedEmail = createForm.email.trim().toLowerCase();

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: createForm.password,
        email_confirm: true,
        user_metadata: {
          organisation_id: orgId,
          prenom: createForm.prenom.trim(),
          nom: createForm.nom.trim(),
        },
      });

      if (authError) throw authError;
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("Utilisateur Auth créé sans identifiant. Vérifiez Supabase Auth.");

      const { error: profileError } = await supabase.from("profiles").insert({
        auth_user_id: authUserId,
        organisation_id: orgId,
        prenom: createForm.prenom.trim(),
        nom: createForm.nom.trim(),
        email: normalizedEmail,
        role: createForm.role.trim(),
        must_change_password: true,
      });

      if (profileError) {
        alert(
          "Le compte Auth a bien été créé, mais l'insertion dans profiles a échoué. " +
            "L'utilisateur existe donc sans profil (orphelin). Détail: " +
            profileError.message,
        );
        return;
      }

      alert("Collaborateur créé avec succès. Notez le mot de passe : " + createForm.password);
      setCreateForm(defaultCreateForm);
      setIsCreating(false);
      await loadData();

    } catch (error: any) {
      alert("Erreur critique : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCollab || !orgId) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nom: selectedCollab.nom,
        prenom: selectedCollab.prenom,
        equipe: selectedCollab.equipe,
        role: selectedCollab.role,
      })
      .eq("id", selectedCollab.id)
      .eq("organisation_id", orgId);

    if (error) alert(error.message);
    else {
      setSelectedCollab(null);
      await loadData();
    }
    setLoading(false);
  };

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Collaborateurs</h1>
          <p style={pageSubtitleStyle}>Gestion des accès et mots de passe temporaires.</p>
        </div>
      </header>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={panelStyle}>
          <div style={panelHeaderRowStyle}>
            <h2 style={panelTitleStyle}>Membres ({collabList.length})</h2>
            <button style={addMemberButtonStyle} onClick={() => { setIsCreating(true); setSelectedCollab(null); }}>
              <span style={plusIconStyle}>+</span> Nouveau
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            {collabList.map((collab) => (
              <article key={collab.id} style={itemStyle}>
                <button style={itemIdentityButtonStyle} onClick={() => { setSelectedCollab(collab); setIsCreating(false); }}>
                  <div style={itemNameStyle}>{collab.prenom} {collab.nom}</div>
                  <div style={itemRoleStyle}>
                    {collab.role} {collab.must_change_password && "• ⚠️ Mdp à changer"}
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>{isCreating ? "Nouvel accès" : "Fiche profil"}</h2>
          {isCreating ? (
            <div style={formStyle}>
              <div style={inputGroupStyle}>
                <input style={inputStyle} placeholder="Prénom" value={createForm.prenom} onChange={e => setCreateForm({...createForm, prenom: e.target.value})} />
                <input style={inputStyle} placeholder="Nom" value={createForm.nom} onChange={e => setCreateForm({...createForm, nom: e.target.value})} />
              </div>
              <input style={inputStyle} placeholder="Email professionnel" type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  style={{ ...inputStyle, flex: 1 }} 
                  type="text"
                  placeholder="Mot de passe temporaire" 
                  value={createForm.password} 
                  onChange={e => setCreateForm({...createForm, password: e.target.value})}
                />
                <button type="button" onClick={generateTempPassword} style={secondaryButtonStyle}>Générer</button>
              </div>

              <select style={inputStyle} value={createForm.role} onChange={e => setCreateForm({...createForm, role: e.target.value})}>
                <option value="Collaborateur">Collaborateur</option>
                <option value="Manager">Manager</option>
                <option value="Administrateur">Administrateur</option>
              </select>

              <button onClick={handleCreate} disabled={loading} style={saveButtonStyle}>
                {loading ? "Création du compte..." : "Créer et activer l'accès"}
              </button>
            </div>
          ) : selectedCollab ? (
            <div style={formStyle}>
              <input style={inputStyle} value={selectedCollab.prenom || ""} onChange={e => setSelectedCollab({...selectedCollab, prenom: e.target.value})} />
              <input style={inputStyle} value={selectedCollab.nom || ""} onChange={e => setSelectedCollab({...selectedCollab, nom: e.target.value})} />
              <input style={inputStyle} value={selectedCollab.role || ""} onChange={e => setSelectedCollab({...selectedCollab, role: e.target.value})} />
              <button onClick={handleUpdate} disabled={loading} style={saveButtonStyle}>Mettre à jour</button>
            </div>
          ) : (
            <div style={emptyStateStyle}>Sélectionnez un membre pour voir les détails.</div>
          )}
        </section>
      </div>
    </div>
  );
}

// Styles complémentaires à ajouter à votre fichier
const inputGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px' };
const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.8rem'
};

// ... (Gardez vos autres styles existants ici)
