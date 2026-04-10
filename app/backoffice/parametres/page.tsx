"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

// ============================================================
// TYPES
// ============================================================

interface Collaborateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  equipe: string;
  matricule: string;
  telephone: string;
  autorisations: string;
  organisation_id: string;
}

interface TvaConfig {
  id?: string;
  taux_standard: number;
  taux_reduit: number;
  taux_super_reduit: number;
  organisation_id?: string;
}

interface Categorie {
  id: string;
  nom: string;
  description: string;
  couleur: string;
  organisation_id: string;
}

interface Emplacement {
  id: string;
  nom: string;
  type: 'depot' | 'zone' | 'rayon';
  description: string;
  capacite: number;
  organisation_id: string;
}

type EmplacementForm = {
  nom: string;
  type: Emplacement['type'];
  description: string;
  capacite: number;
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ActiveView {
  category: string;
  action: string;
}

type ProfileForm = {
  nom: string;
  prenom: string;
  email: string;
  role: string;
  equipe: string;
  matricule: string;
  telephone: string;
  autorisations: string;
};

// ============================================================
// COMPOSANT TOAST
// ============================================================

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div style={toastContainerStyle}>
      {toasts.map((t) => (
        <div key={t.id} style={toastStyle(t.type)}>
          <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={toastCloseStyle}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PAGE PRINCIPALE
// ============================================================

export default function ParametresPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // --- Collaborateurs ---
  const [collabList, setCollabList] = useState<Collaborateur[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('Tous');
  const [filterEquipe, setFilterEquipe] = useState<string>('Toutes');
  const [newProfile, setNewProfile] = useState<ProfileForm>({
    nom: '', prenom: '', email: '', role: 'Commercial',
    equipe: 'Ventes', matricule: '', telephone: '', autorisations: 'Standard',
  });

  // --- TVA ---
  const [tvaConfig, setTvaConfig] = useState<TvaConfig>({
    taux_standard: 20,
    taux_reduit: 10,
    taux_super_reduit: 5.5,
  });
  const [tvaId, setTvaId] = useState<string | null>(null);

  // --- Categories ---
  const [categorieList, setCategorieList] = useState<Categorie[]>([]);
  const [newCategorie, setNewCategorie] = useState({ nom: '', description: '', couleur: '#6366f1' });
  const [showAddCat, setShowAddCat] = useState<boolean>(false);

  // --- Emplacements ---
  const [emplacementList, setEmplacementList] = useState<Emplacement[]>([]);
  const [newEmplacement, setNewEmplacement] = useState<EmplacementForm>({
    nom: '',
    type: 'depot',
    description: '',
    capacite: 0,
  });
  const [showAddEmp, setShowAddEmp] = useState<boolean>(false);

  // ============================================================
  // TOAST HELPERS
  // ============================================================

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ============================================================
  // CHARGEMENT DES DONNEES
  // ============================================================

  const loadCollabs = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organisation_id', id);
    if (!error && data) setCollabList(data as Collaborateur[]);
  }, []);

  const loadTva = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('tva_config')
      .select('*')
      .eq('organisation_id', id)
      .single();
    if (!error && data) {
      setTvaConfig({
        taux_standard: data.taux_standard,
        taux_reduit: data.taux_reduit,
        taux_super_reduit: data.taux_super_reduit,
      });
      setTvaId(data.id);
    }
  }, []);

  const loadCategories = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('organisation_id', id)
      .order('nom', { ascending: true });
    if (!error && data) setCategorieList(data as Categorie[]);
  }, []);

  const loadEmplacements = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('emplacements')
      .select('*')
      .eq('organisation_id', id)
      .order('nom', { ascending: true });
    if (!error && data) setEmplacementList(data as Emplacement[]);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const id: string = session.user.user_metadata.organisation_id;
        setOrgId(id);
        await loadCollabs(id);
        await loadTva(id);
        await loadCategories(id);
        await loadEmplacements(id);
      }
    };
    init();
  }, [loadCollabs, loadTva, loadCategories, loadEmplacements]);

  // ============================================================
  // COLLABORATEURS
  // ============================================================

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.admin.inviteUserByEmail(newProfile.email, {
        data: {
          nom: newProfile.nom,
          prenom: newProfile.prenom,
          matricule: newProfile.matricule,
          telephone: newProfile.telephone,
          role: newProfile.role,
          equipe: newProfile.equipe,
          autorisations: newProfile.autorisations,
          organisation_id: orgId,
          nom_complet: `${newProfile.prenom} ${newProfile.nom}`,
        },
      });
      if (error) {
        addToast(`Erreur : ${error.message}`, 'error');
      } else {
        addToast('Invitation envoyee avec succes.', 'success');
        setNewProfile({ nom: '', prenom: '', email: '', role: 'Commercial', equipe: 'Ventes', matricule: '', telephone: '', autorisations: 'Standard' });
        setActiveView({ category: 'collab', action: 'list' });
        await loadCollabs(orgId);
      }
    } catch {
      addToast('Une erreur inattendue est survenue.', 'error');
    }
    setLoading(false);
  };

  const handleDeleteCollab = async (id: string) => {
    if (!confirm('Confirmer la suppression de ce collaborateur ?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      addToast(`Erreur : ${error.message}`, 'error');
    } else {
      addToast('Collaborateur supprime.', 'success');
      await loadCollabs(orgId);
    }
  };

  const filteredCollabs = collabList.filter((c) => {
    const searchString = `${c.nom ?? ''} ${c.prenom ?? ''} ${c.matricule ?? ''} ${c.email ?? ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'Tous' || c.role === filterRole;
    const matchesEquipe = filterEquipe === 'Toutes' || c.equipe === filterEquipe;
    return matchesSearch && matchesRole && matchesEquipe;
  });

  const equipes = ['Toutes', ...Array.from(new Set(collabList.map((c) => c.equipe).filter(Boolean)))];

  // ============================================================
  // TVA
  // ============================================================

  const handleSaveTva = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tvaId) {
        const { error } = await supabase
          .from('tva_config')
          .update({ ...tvaConfig })
          .eq('id', tvaId);
        if (error) addToast(`Erreur : ${error.message}`, 'error');
        else addToast('Taux de TVA mis a jour.', 'success');
      } else {
        const { data, error } = await supabase
          .from('tva_config')
          .insert([{ ...tvaConfig, organisation_id: orgId }])
          .select()
          .single();
        if (error) addToast(`Erreur : ${error.message}`, 'error');
        else {
          setTvaId(data.id);
          addToast('Configuration TVA creee.', 'success');
        }
      }
    } catch {
      addToast('Une erreur inattendue est survenue.', 'error');
    }
    setLoading(false);
  };

  // ============================================================
  // CATEGORIES
  // ============================================================

  const handleCreateCategorie = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from('categories')
      .insert([{ ...newCategorie, organisation_id: orgId }]);
    if (error) {
      addToast(`Erreur : ${error.message}`, 'error');
    } else {
      addToast('Categorie creee.', 'success');
      setNewCategorie({ nom: '', description: '', couleur: '#6366f1' });
      setShowAddCat(false);
      await loadCategories(orgId);
    }
    setLoading(false);
  };

  const handleDeleteCategorie = async (id: string) => {
    if (!confirm('Supprimer cette categorie ?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) addToast(`Erreur : ${error.message}`, 'error');
    else {
      addToast('Categorie supprimee.', 'success');
      await loadCategories(orgId);
    }
  };

  // ============================================================
  // EMPLACEMENTS
  // ============================================================

  const handleCreateEmplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from('emplacements')
      .insert([{ ...newEmplacement, organisation_id: orgId }]);
    if (error) {
      addToast(`Erreur : ${error.message}`, 'error');
    } else {
      addToast('Emplacement cree.', 'success');
      setNewEmplacement({ nom: '', type: 'depot', description: '', capacite: 0 });
      setShowAddEmp(false);
      await loadEmplacements(orgId);
    }
    setLoading(false);
  };

  const handleDeleteEmplacement = async (id: string) => {
    if (!confirm('Supprimer cet emplacement ?')) return;
    const { error } = await supabase.from('emplacements').delete().eq('id', id);
    if (error) addToast(`Erreur : ${error.message}`, 'error');
    else {
      addToast('Emplacement supprime.', 'success');
      await loadEmplacements(orgId);
    }
  };

  // ============================================================
  // CONFIG MENUS
  // ============================================================

  const menuConfig = [
    {
      id: 'collab', label: 'Collaborateurs',
      options: [
        { label: 'Liste des membres', action: 'list' },
        { label: 'Creer un profil complet', action: 'add' },
      ],
    },
    {
      id: 'taxes', label: 'Fiscalite',
      options: [{ label: 'Modifier la TVA', action: 'tva' }],
    },
    {
      id: 'cats', label: 'Categories',
      options: [{ label: 'Gerer les segments', action: 'list' }],
    },
    {
      id: 'loc', label: 'Emplacements',
      options: [{ label: 'Depots et Stockage', action: 'list' }],
    },
  ];

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="page-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <h1 style={{ fontWeight: 900, marginBottom: '25px', fontSize: '1.8rem' }}>
        Configuration Kipilote
      </h1>

      {/* BARRE DE NAVIGATION SECONDAIRE */}
      <nav style={subNavBar}>
        {menuConfig.map((menu) => (
          <div key={menu.id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
              style={menuButtonStyle(openMenu === menu.id)}
            >
              {menu.label}
              <span style={{ fontSize: '0.6rem', marginLeft: '8px' }}>
                {openMenu === menu.id ? '▲' : '▼'}
              </span>
            </button>
            {openMenu === menu.id && (
              <div style={dropdownStyle}>
                {menu.options.map((opt, i) => (
                  <div
                    key={i}
                    style={dropdownItem}
                    onClick={() => {
                      setActiveView({ category: menu.id, action: opt.action });
                      setOpenMenu(null);
                      setShowAddCat(false);
                      setShowAddEmp(false);
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div style={contentArea}>

        {/* ===================================================== */}
        {/* VUE : LISTE DES COLLABORATEURS                        */}
        {/* ===================================================== */}
        {activeView?.category === 'collab' && activeView.action === 'list' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Annuaire de l&apos;equipe</h2>
              <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
            </div>

            {/* Filtres */}
            <div style={filterPanel}>
              <div style={{ flex: 2 }}>
                <label style={labelS}>Recherche multi-critere</label>
                <input
                  style={inS}
                  placeholder="Nom, prenom, matricule, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelS}>Role</label>
                <select style={inS} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                  <option>Tous</option>
                  <option>Administrateur</option>
                  <option>Gestionnaire Stock</option>
                  <option>Commercial</option>
                  <option>Logistique</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelS}>Equipe</label>
                <select style={inS} value={filterEquipe} onChange={(e) => setFilterEquipe(e.target.value)}>
                  {equipes.map((eq) => <option key={eq}>{eq}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  style={resetBtn}
                  onClick={() => { setSearchTerm(''); setFilterRole('Tous'); setFilterEquipe('Toutes'); }}
                >
                  Voir tout
                </button>
              </div>
            </div>

            {/* Tableau */}
            <table style={tableS}>
              <thead>
                <tr style={thRow}>
                  <th style={thS}>Matricule</th>
                  <th style={thS}>Nom Complet</th>
                  <th style={thS}>Email</th>
                  <th style={thS}>Equipe</th>
                  <th style={thS}>Role</th>
                  <th style={thS}>Autorisations</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollabs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                      Aucun collaborateur trouve.
                    </td>
                  </tr>
                ) : (
                  filteredCollabs.map((c) => (
                    <tr key={c.id} style={trRow}>
                      <td style={tdS}>{c.matricule || '-'}</td>
                      <td style={tdS}><strong>{c.prenom} {c.nom}</strong></td>
                      <td style={tdS}>{c.email}</td>
                      <td style={tdS}>{c.equipe || 'N/A'}</td>
                      <td style={tdS}><span style={roleTag}>{c.role}</span></td>
                      <td style={tdS}><span style={autorisationTag(c.autorisations)}>{c.autorisations}</span></td>
                      <td style={tdS}>
                        <button
                          style={dangerBtn}
                          onClick={() => handleDeleteCollab(c.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================== */}
        {/* VUE : FORMULAIRE CREATION COLLABORATEUR               */}
        {/* ===================================================== */}
        {activeView?.category === 'collab' && activeView.action === 'add' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Nouveau Profil Collaborateur</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Un email d&apos;invitation sera envoye automatiquement.
                </p>
              </div>
              <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
            </div>
            <form onSubmit={handleCreateProfile}>
              <div style={grid3}>
                <div style={inputBox}>
                  <label style={labelS}>Prenom *</label>
                  <input style={inS} value={newProfile.prenom} onChange={(e) => setNewProfile({ ...newProfile, prenom: e.target.value })} required />
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Nom *</label>
                  <input style={inS} value={newProfile.nom} onChange={(e) => setNewProfile({ ...newProfile, nom: e.target.value })} required />
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Matricule</label>
                  <input style={inS} value={newProfile.matricule} onChange={(e) => setNewProfile({ ...newProfile, matricule: e.target.value })} />
                </div>
              </div>
              <div style={grid2}>
                <div style={inputBox}>
                  <label style={labelS}>Email *</label>
                  <input style={inS} type="email" value={newProfile.email} onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })} required />
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Telephone</label>
                  <input style={inS} value={newProfile.telephone} onChange={(e) => setNewProfile({ ...newProfile, telephone: e.target.value })} />
                </div>
              </div>
              <div style={grid3}>
                <div style={inputBox}>
                  <label style={labelS}>Role</label>
                  <select style={inS} value={newProfile.role} onChange={(e) => setNewProfile({ ...newProfile, role: e.target.value })}>
                    <option>Administrateur</option>
                    <option>Gestionnaire Stock</option>
                    <option>Commercial</option>
                    <option>Logistique</option>
                  </select>
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Equipe</label>
                  <input style={inS} value={newProfile.equipe} onChange={(e) => setNewProfile({ ...newProfile, equipe: e.target.value })} />
                </div>
                <div style={inputBox}>
                  <label style={labelS}>Autorisations</label>
                  <select style={inS} value={newProfile.autorisations} onChange={(e) => setNewProfile({ ...newProfile, autorisations: e.target.value })}>
                    <option>Standard</option>
                    <option>Acces Total</option>
                    <option>Lecture Seule</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setActiveView(null)} style={secondaryBtn}>Annuler</button>
                <button type="submit" disabled={loading} style={submitBtn}>
                  {loading ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================== */}
        {/* VUE : FISCALITE — CONFIGURATION TVA                   */}
        {/* ===================================================== */}
        {activeView?.category === 'taxes' && activeView.action === 'tva' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Configuration de la TVA</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Ces taux s&apos;appliquent a l&apos;ensemble des produits et services de votre organisation.
                </p>
              </div>
              <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
            </div>

            <form onSubmit={handleSaveTva}>
              <div style={tvaGrid}>

                <div style={tvaCard}>
                  <div style={tvaCardIcon}>%</div>
                  <div>
                    <label style={labelS}>Taux Standard</label>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 10px' }}>
                      Applicable a la majorite des biens et services.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        style={{ ...inS, width: '120px' }}
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={tvaConfig.taux_standard}
                        onChange={(e) => setTvaConfig({ ...tvaConfig, taux_standard: parseFloat(e.target.value) })}
                        required
                      />
                      <span style={{ fontWeight: 700, color: '#475569' }}>%</span>
                    </div>
                  </div>
                </div>

                <div style={tvaCard}>
                  <div style={tvaCardIcon}>%</div>
                  <div>
                    <label style={labelS}>Taux Reduit</label>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 10px' }}>
                      Alimentation, transport, restauration.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        style={{ ...inS, width: '120px' }}
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={tvaConfig.taux_reduit}
                        onChange={(e) => setTvaConfig({ ...tvaConfig, taux_reduit: parseFloat(e.target.value) })}
                        required
                      />
                      <span style={{ fontWeight: 700, color: '#475569' }}>%</span>
                    </div>
                  </div>
                </div>

                <div style={tvaCard}>
                  <div style={tvaCardIcon}>%</div>
                  <div>
                    <label style={labelS}>Taux Super Reduit</label>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 10px' }}>
                      Medicaments, presse, livres.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        style={{ ...inS, width: '120px' }}
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={tvaConfig.taux_super_reduit}
                        onChange={(e) => setTvaConfig({ ...tvaConfig, taux_super_reduit: parseFloat(e.target.value) })}
                        required
                      />
                      <span style={{ fontWeight: 700, color: '#475569' }}>%</span>
                    </div>
                  </div>
                </div>

              </div>

              <div style={tvaInfoBanner}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                  Note : Ces taux sont ceux en vigueur par defaut en France. Verifiez leur conformite avec votre legislation locale avant toute modification.
                </span>
              </div>

              <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={loading} style={submitBtn}>
                  {loading ? 'Enregistrement...' : 'Enregistrer les taux'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================== */}
        {/* VUE : CATEGORIES                                       */}
        {/* ===================================================== */}
        {activeView?.category === 'cats' && activeView.action === 'list' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Gestion des Categories</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowAddCat(!showAddCat)} style={submitBtn}>
                  {showAddCat ? 'Annuler' : '+ Nouvelle categorie'}
                </button>
                <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
              </div>
            </div>

            {/* Formulaire d'ajout */}
            {showAddCat && (
              <form onSubmit={handleCreateCategorie} style={inlineFormBox}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '15px', color: '#0f172a' }}>
                  Nouvelle Categorie
                </h3>
                <div style={grid3}>
                  <div style={inputBox}>
                    <label style={labelS}>Nom *</label>
                    <input
                      style={inS}
                      value={newCategorie.nom}
                      onChange={(e) => setNewCategorie({ ...newCategorie, nom: e.target.value })}
                      placeholder="Ex : Electronique"
                      required
                    />
                  </div>
                  <div style={inputBox}>
                    <label style={labelS}>Description</label>
                    <input
                      style={inS}
                      value={newCategorie.description}
                      onChange={(e) => setNewCategorie({ ...newCategorie, description: e.target.value })}
                      placeholder="Description courte..."
                    />
                  </div>
                  <div style={inputBox}>
                    <label style={labelS}>Couleur d&apos;identification</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="color"
                        value={newCategorie.couleur}
                        onChange={(e) => setNewCategorie({ ...newCategorie, couleur: e.target.value })}
                        style={{ width: '48px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '2px' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{newCategorie.couleur}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                  <button type="submit" disabled={loading} style={submitBtn}>
                    {loading ? 'Enregistrement...' : 'Creer la categorie'}
                  </button>
                </div>
              </form>
            )}

            {/* Liste */}
            <table style={tableS}>
              <thead>
                <tr style={thRow}>
                  <th style={thS}>Couleur</th>
                  <th style={thS}>Nom</th>
                  <th style={thS}>Description</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categorieList.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                      Aucune categorie creee. Cliquez sur &quot;+ Nouvelle categorie&quot; pour commencer.
                    </td>
                  </tr>
                ) : (
                  categorieList.map((cat) => (
                    <tr key={cat.id} style={trRow}>
                      <td style={tdS}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: cat.couleur }} />
                      </td>
                      <td style={tdS}><strong>{cat.nom}</strong></td>
                      <td style={tdS}>{cat.description || '-'}</td>
                      <td style={tdS}>
                        <button style={dangerBtn} onClick={() => handleDeleteCategorie(cat.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================== */}
        {/* VUE : EMPLACEMENTS                                     */}
        {/* ===================================================== */}
        {activeView?.category === 'loc' && activeView.action === 'list' && (
          <div style={viewCard}>
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Depots et Zones de Stockage</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowAddEmp(!showAddEmp)} style={submitBtn}>
                  {showAddEmp ? 'Annuler' : '+ Nouvel emplacement'}
                </button>
                <button onClick={() => setActiveView(null)} style={closeBtn}>Fermer</button>
              </div>
            </div>

            {/* Formulaire d'ajout */}
            {showAddEmp && (
              <form onSubmit={handleCreateEmplacement} style={inlineFormBox}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '15px', color: '#0f172a' }}>
                  Nouvel Emplacement
                </h3>
                <div style={grid2}>
                  <div style={inputBox}>
                    <label style={labelS}>Nom *</label>
                    <input
                      style={inS}
                      value={newEmplacement.nom}
                      onChange={(e) => setNewEmplacement({ ...newEmplacement, nom: e.target.value })}
                      placeholder="Ex : Depot Principal"
                      required
                    />
                  </div>
                  <div style={inputBox}>
                    <label style={labelS}>Type</label>
                    <select
                      style={inS}
                      value={newEmplacement.type}
                      onChange={(e) => setNewEmplacement({ ...newEmplacement, type: e.target.value as 'depot' | 'zone' | 'rayon' })}
                    >
                      <option value="depot">Depot</option>
                      <option value="zone">Zone</option>
                      <option value="rayon">Rayon</option>
                    </select>
                  </div>
                </div>
                <div style={grid2}>
                  <div style={inputBox}>
                    <label style={labelS}>Description</label>
                    <input
                      style={inS}
                      value={newEmplacement.description}
                      onChange={(e) => setNewEmplacement({ ...newEmplacement, description: e.target.value })}
                      placeholder="Description courte..."
                    />
                  </div>
                  <div style={inputBox}>
                    <label style={labelS}>Capacite (unites)</label>
                    <input
                      style={inS}
                      type="number"
                      min={0}
                      value={newEmplacement.capacite}
                      onChange={(e) => setNewEmplacement({ ...newEmplacement, capacite: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                  <button type="submit" disabled={loading} style={submitBtn}>
                    {loading ? 'Enregistrement...' : 'Creer l\'emplacement'}
                  </button>
                </div>
              </form>
            )}

            {/* Liste */}
            <table style={tableS}>
              <thead>
                <tr style={thRow}>
                  <th style={thS}>Nom</th>
                  <th style={thS}>Type</th>
                  <th style={thS}>Description</th>
                  <th style={thS}>Capacite</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {emplacementList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                      Aucun emplacement cree. Cliquez sur &quot;+ Nouvel emplacement&quot; pour commencer.
                    </td>
                  </tr>
                ) : (
                  emplacementList.map((emp) => (
                    <tr key={emp.id} style={trRow}>
                      <td style={tdS}><strong>{emp.nom}</strong></td>
                      <td style={tdS}><span style={typeTag(emp.type)}>{emp.type.charAt(0).toUpperCase() + emp.type.slice(1)}</span></td>
                      <td style={tdS}>{emp.description || '-'}</td>
                      <td style={tdS}>{emp.capacite > 0 ? `${emp.capacite} u.` : '-'}</td>
                      <td style={tdS}>
                        <button style={dangerBtn} onClick={() => handleDeleteEmplacement(emp.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ETAT VIDE */}
        {!activeView && (
          <div style={emptyState}>
            <p style={{ color: '#64748b', fontWeight: 600 }}>
              Selectionnez une action dans le menu pour commencer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const toastContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  maxWidth: '380px',
};

const toastStyle = (type: 'success' | 'error'): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '12px',
  background: type === 'success' ? '#f0fdf4' : '#fef2f2',
  border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`,
  color: type === 'success' ? '#166534' : '#991b1b',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  animation: 'slideIn 0.2s ease-out',
});

const toastCloseStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.8rem',
  opacity: 0.6,
  padding: '2px 6px',
};

const subNavBar: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  background: 'white',
  padding: '10px',
  borderRadius: '15px',
  border: '1px solid #e2e8f0',
  marginBottom: '25px',
  position: 'relative',
};

const menuButtonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#f1f5f9' : 'transparent',
  color: '#475569',
  border: 'none',
  padding: '10px 20px',
  borderRadius: '10px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
});

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50px',
  left: 0,
  background: 'white',
  minWidth: '220px',
  borderRadius: '12px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  border: '1px solid #e2e8f0',
  zIndex: 100,
};

const dropdownItem: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
  cursor: 'pointer',
  borderBottom: '1px solid #f1f5f9',
};

const contentArea: React.CSSProperties = { minHeight: '400px' };

const viewCard: React.CSSProperties = {
  background: 'white',
  padding: '30px',
  borderRadius: '20px',
  border: '1px solid #e2e8f0',
};

const cardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '25px',
  paddingBottom: '15px',
  borderBottom: '1px solid #f1f5f9',
};

const closeBtn: React.CSSProperties = {
  background: '#f1f5f9',
  border: 'none',
  padding: '6px 12px',
  borderRadius: '8px',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const filterPanel: React.CSSProperties = {
  display: 'flex',
  gap: '15px',
  background: '#f8fafc',
  padding: '20px',
  borderRadius: '15px',
  marginBottom: '25px',
  flexWrap: 'wrap',
};

const labelS: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 900,
  color: '#64748b',
  marginBottom: '6px',
  textTransform: 'uppercase',
  display: 'block',
};

const inS: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  outline: 'none',
  fontSize: '0.9rem',
  width: '100%',
  background: 'white',
  boxSizing: 'border-box',
};

const resetBtn: React.CSSProperties = {
  background: '#6366f1',
  color: 'white',
  border: 'none',
  padding: '10px 20px',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const tableS: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thRow: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '2px solid #f1f5f9',
};

const thS: React.CSSProperties = {
  padding: '15px 10px',
  fontSize: '0.7rem',
  color: '#94a3b8',
  fontWeight: 800,
};

const tdS: React.CSSProperties = {
  padding: '15px 10px',
  fontSize: '0.85rem',
  borderBottom: '1px solid #f1f5f9',
};

const trRow: React.CSSProperties = { transition: '0.2s' };

const roleTag: React.CSSProperties = {
  background: '#e0e7ff',
  color: '#6366f1',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '0.7rem',
  fontWeight: 700,
};

const autorisationTag = (level: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    'Acces Total': { background: '#dcfce7', color: '#166534' },
    'Standard': { background: '#fef9c3', color: '#854d0e' },
    'Lecture Seule': { background: '#f1f5f9', color: '#475569' },
  };
  return {
    ...(map[level] ?? map['Standard']),
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 700,
  };
};

const typeTag = (type: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    depot: { background: '#e0e7ff', color: '#4338ca' },
    zone: { background: '#dcfce7', color: '#166534' },
    rayon: { background: '#fef3c7', color: '#92400e' },
  };
  return {
    ...(map[type] ?? {}),
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 700,
  };
};

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '20px',
  marginBottom: '15px',
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '15px',
};

const inputBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const submitBtn: React.CSSProperties = {
  background: '#0f172a',
  color: 'white',
  border: 'none',
  padding: '12px 25px',
  borderRadius: '10px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const secondaryBtn: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#475569',
  border: 'none',
  padding: '12px 25px',
  borderRadius: '10px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const dangerBtn: React.CSSProperties = {
  background: '#fef2f2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  padding: '6px 12px',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.75rem',
};

const tvaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '20px',
  marginBottom: '20px',
};

const tvaCard: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '15px',
  padding: '20px',
  display: 'flex',
  gap: '15px',
  alignItems: 'flex-start',
};

const tvaCardIcon: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: '#e0e7ff',
  color: '#6366f1',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: '1.1rem',
  flexShrink: 0,
};

const tvaInfoBanner: React.CSSProperties = {
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '10px',
  padding: '12px 16px',
};

const inlineFormBox: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '15px',
  padding: '20px',
  marginBottom: '25px',
};

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '100px 0',
  border: '2px dashed #e2e8f0',
  borderRadius: '20px',
};
