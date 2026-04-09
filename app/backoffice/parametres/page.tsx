"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function ParametresPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<{ category: string, action: string } | null>(null);
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

  useEffect(() => { loadData(); }, []);

  const menuConfig = [
    {
      id: 'collab', label: 'Collaborateurs', icon: '👥',
      options: [
        { label: 'Liste des membres', action: 'list' },
        { label: 'Ajouter un membre', action: 'add' }
      ]
    },
    { id: 'taxes', label: 'Fiscalité', icon: '📊', options: [{ label: 'Modifier la TVA', action: 'tva' }] },
    { id: 'cats', label: 'Catégories', icon: '🏷️', options: [{ label: 'Liste', action: 'list' }] },
    { id: 'loc', label: 'Emplacements', icon: '📍', options: [{ label: 'Gérer les dépôts', action: 'list' }] }
  ];

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <h1 style={{ fontWeight: 900, marginBottom: '25px', fontSize: '2rem' }}>Configuration <span style={{color:'#6366f1'}}>Kipilote</span></h1>

      {/* BARRE DE MENU SECONDAIRE */}
      <nav style={subNavBar}>
        {menuConfig.map((menu) => (
          <div key={menu.id} style={{ position: 'relative' }}>
            <button onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)} style={menuButtonStyle(openMenu === menu.id)}>
              <span style={{ marginRight: '8px' }}>{menu.icon}</span>{menu.label}
            </button>
            {openMenu === menu.id && (
              <div style={dropdownStyle}>
                {menu.options.map((opt, i) => (
                  <div key={i} style={dropdownItem} onClick={() => { setActiveView({ category: menu.id, action: opt.action }); setOpenMenu(null); if(opt.action === 'add') setSelectedCollab({nom:'', email:'', role:'Commercial'}); }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* ZONE D'AFFICHAGE */}
      <div style={contentArea}>
        {!activeView ? (
          <div style={welcomeBox}>
            <div style={{fontSize: '3rem', marginBottom: '15px'}}>⚙️</div>
            <h2 style={{fontWeight: 800}}>Prêt à configurer ?</h2>
            <p style={{color: '#64748b'}}>Utilisez le menu ci-dessus pour gérer votre équipe, vos taxes ou vos emplacements.</p>
          </div>
        ) : (
          <div style={viewCard}>
            {activeView.category === 'collab' && activeView.action === 'list' && (
              <>
                <h3 style={viewTitle}>Liste de l'équipe</h3>
                <div style={tableWrap}>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr style={{textAlign: 'left', borderBottom: '2px solid #f1f5f9'}}>
                        <th style={thS}>NOM</th><th style={thS}>RÔLE</th><th style={thS}>EMAIL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collabList.map(c => (
                        <tr key={c.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                          <td style={tdS}><strong>{c.nom}</strong></td>
                          <td style={tdS}><span style={roleTag}>{c.role}</span></td>
                          <td style={tdS}>{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            
            {activeView.category === 'collab' && activeView.action === 'add' && (
               <div>
                  <h3 style={viewTitle}>Nouvelle invitation</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px'}}>
                     <input style={inS} placeholder="Nom Complet" value={selectedCollab?.nom} onChange={e => setSelectedCollab({...selectedCollab, nom: e.target.value})} />
                     <input style={inS} placeholder="Email" value={selectedCollab?.email} onChange={e => setSelectedCollab({...selectedCollab, email: e.target.value})} />
                     <button style={btnS}>Envoyer l'invitation</button>
                  </div>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// STYLES
const subNavBar = { display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '25px', flexWrap: 'wrap' as any };
const menuButtonStyle = (active: boolean) => ({ background: active ? '#6366f1' : 'transparent', color: active ? 'white' : '#475569', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' });
const dropdownStyle = { position: 'absolute' as any, top: '50px', left: 0, background: 'white', minWidth: '200px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100 };
const dropdownItem = { padding: '12px 15px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' };
const contentArea = { minHeight: '400px' };
const welcomeBox = { textAlign: 'center' as any, padding: '80px 20px', border: '2px dashed #e2e8f0', borderRadius: '30px', background: 'white' };
const viewCard = { background: 'white', padding: '30px', borderRadius: '25px', border: '1px solid #e2e8f0' };
const viewTitle = { marginTop: 0, marginBottom: '20px', fontWeight: 900 };
const tableWrap = { overflowX: 'auto' as any };
const thS = { padding: '12px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 };
const tdS = { padding: '12px', fontSize: '0.9rem' };
const roleTag = { background: '#e0e7ff', color: '#6366f1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 };
const inS = { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' };
const btnS = { background: '#6366f1', color: 'white', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' };