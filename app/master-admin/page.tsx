"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useRouter } from 'next/navigation';

// Configuration des tarifs pour le calcul dynamique
const PLAN_PRICES = { STARTER: 29, PRO: 79, ENTERPRISE: 199 };

export default function MasterAdmin() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [verifyingOrg, setVerifyingOrg] = useState<any>(null);
  const [inputCode, setInputCode] = useState("");
  const router = useRouter();

  // 1. Chargement des données depuis Supabase
  const fetchOrgs = async () => {
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Erreur de chargement:", error.message);
    } else if (data) {
      setOrgs(data);
    }
  };

  useEffect(() => {
    fetchOrgs();

    // Système temps réel pour les inscriptions
    const channel = supabase
      .channel('master-global-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, 
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [{txt: `Nouveau client : ${payload.new.nom}`, date: new Date()}, ...prev]);
        }
        fetchOrgs(); // Rafraîchissement global sur tout changement
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- CALCULS EN TEMPS RÉEL ---
  const activeOrgs = orgs.filter(o => o.statut !== 'suspendu');
  const totalRevenus = activeOrgs.reduce((acc, org) => {
    const plan = (org.plan || 'STARTER').toUpperCase() as keyof typeof PLAN_PRICES;
    return acc + (PLAN_PRICES[plan] || 0);
  }, 0);

  const filteredOrgs = orgs.filter(o => 
    o.nom?.toLowerCase().includes(search.toLowerCase())
  );

  // --- ACTIONS SÉCURISÉES (UPDATE DÉTERMINISTE) ---
  
  const updatePlan = async (id: string, newPlan: string) => {
    // .update() avec .eq(id) garantit qu'on modifie l'existant sans créer de doublon
    const { error } = await supabase
      .from('organisations')
      .update({ plan: newPlan })
      .eq('id', id);

    if (!error) {
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, plan: newPlan } : o));
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspendu' ? 'actif' : 'suspendu';
    const { error } = await supabase
      .from('organisations')
      .update({ statut: newStatus })
      .eq('id', id);

    if (!error) {
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, statut: newStatus } : o));
    }
  };

  const deleteOrg = async (id: string, nom: string) => {
    if (window.confirm(`⚠️ SUPPRIMER DÉFINITIVEMENT "${nom}" ?\nCette action effacera TOUTES les données liées.`)) {
      const { error } = await supabase
        .from('organisations')
        .delete()
        .eq('id', id);

      if (!error) {
        setOrgs(prev => prev.filter(o => o.id !== id));
      } else {
        alert("Erreur de suppression : vérifiez les permissions RLS ou les liens (Cascade).");
      }
    }
  };

  // --- SYSTÈME D'INFILTRATION AVEC CODE ---

  const requestAccess = async (org: any) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase
      .from('organisations')
      .update({ temp_access_code: code })
      .eq('id', org.id);

    if (!error) {
      setVerifyingOrg({ ...org, code });
      setInputCode("");
    }
  };

  const confirmAccess = () => {
    if (inputCode === verifyingOrg.code) {
      localStorage.setItem('impersonated_org_id', verifyingOrg.id);
      // Nettoyage du code sur Supabase
      supabase.from('organisations').update({ temp_access_code: null }).eq('id', verifyingOrg.id);
      router.push('/backoffice/dashboard');
    } else {
      alert("Code incorrect. Demandez le code au client.");
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* 🟢 TOPBAR */}
      <nav style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
          <div style={badgeStyle}>PROPRIÉTAIRE</div>
        </div>

        <div style={{ position: 'relative', width: '350px' }}>
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
          <input 
            placeholder="Rechercher une société..." 
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Guillaume S.</div>
            <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 700 }}>Société Mère : CRM AI</div>
          </div>
          <div style={avatarStyle}>GS</div>
        </div>
      </nav>

      <main style={{ padding: '40px', marginTop: '80px' }}>
        
        {/* STATS */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
            <div style={statBox}>
                <div style={statLabel}>REVENUS MENSUELS ESTIMÉS</div>
                <div style={statValue}>{totalRevenus}€ <span style={{fontSize: '1rem', fontWeight: 400, opacity: 0.6}}>/mois</span></div>
            </div>
            <div style={statBox}>
                <div style={statLabel}>CLIENTS ACTIFS</div>
                <div style={statValue}>{activeOrgs.length} <span style={{fontSize: '1rem', fontWeight: 400, opacity: 0.6}}>sur {orgs.length}</span></div>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '30px' }}>
          
          {/* LISTE PRINCIPALE */}
          <section style={containerStyle}>
            <h3 style={{ marginBottom: '20px' }}>Instances Déployées</h3>
            {orgs.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Aucune donnée disponible.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th>ENTREPRISE</th>
                    <th>PLAN</th>
                    <th>STATUT</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map(org => (
                    <tr key={org.id} style={tableRowStyle}>
                      <td style={{ padding: '15px 0' }}>
                          <div style={{ fontWeight: 700 }}>{org.nom}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: {org.id.substring(0,8)}...</div>
                      </td>
                      <td>
                        <select 
                          value={org.plan} 
                          onChange={(e) => updatePlan(org.id, e.target.value)} 
                          style={selectStyle}
                        >
                          <option value="STARTER">Starter</option>
                          <option value="PRO">Pro</option>
                          <option value="ENTERPRISE">Enterprise</option>
                        </select>
                      </td>
                      <td>
                        <span style={{ 
                           padding: '5px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800,
                           background: org.statut === 'suspendu' ? '#fee2e2' : '#dcfce7',
                           color: org.statut === 'suspendu' ? '#ef4444' : '#10b981',
                           textTransform: 'uppercase'
                        }}>{org.statut || 'actif'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => requestAccess(org)} style={actionBtn} title="Infiltrer">👁️</button>
                        <button onClick={() => toggleStatus(org.id, org.statut)} style={{...actionBtn, color: '#64748b'}} title="Suspendre/Activer">
                          {org.statut === 'suspendu' ? '🔓' : '🔒'}
                        </button>
                        <button onClick={() => deleteOrg(org.id, org.nom)} style={{...actionBtn, color: '#ef4444'}} title="Supprimer">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* NOTIFS SIDEBAR */}
          <aside style={containerStyle}>
            <h3 style={{ marginBottom: '20px', fontSize: '1rem' }}>Historique Live</h3>
            {notifications.length === 0 && <p style={{fontSize: '0.8rem', opacity: 0.5}}>Aucune activité récente.</p>}
            {notifications.map((n, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{n.txt}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{n.date.toLocaleTimeString()}</div>
              </div>
            ))}
          </aside>
        </div>
      </main>

      {/* MODAL SÉCURITÉ INFILTRATION */}
      {verifyingOrg && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Code d'accès requis</h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '10px' }}>
              Le client <strong>{verifyingOrg.nom}</strong> doit vous donner le code affiché sur son écran.
            </p>
            <input 
              maxLength={6} 
              value={inputCode} 
              onChange={(e) => setInputCode(e.target.value)} 
              placeholder="000 000" 
              style={modalInput} 
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setVerifyingOrg(null); setInputCode(""); }} style={cancelBtn}>Annuler</button>
              <button onClick={confirmAccess} style={confirmBtn}>Vérifier & Entrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const topBarStyle = { height: '75px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', position: 'fixed' as any, top: 0, left: 0, right: 0, zIndex: 1000 };
const badgeStyle = { background: '#1e293b', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 };
const searchInputStyle = { width: '100%', padding: '10px 15px 10px 40px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none' };
const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 };
const statBox = { background: 'white', padding: '25px', borderRadius: '20px', flex: 1, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const statLabel = { fontSize: '0.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' };
const statValue = { fontSize: '1.8rem', fontWeight: 900, marginTop: '10px', color: '#1e293b' };
const containerStyle = { background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const tableHeaderStyle = { textAlign: 'left' as any, color: '#64748b', fontSize: '0.75rem', borderBottom: '1px solid #f1f5f9' };
const tableRowStyle = { borderBottom: '1px solid #f8fafc' };
const selectStyle = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' };
const actionBtn = { background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', marginLeft: '12px', transition: 'transform 0.1s' };
const modalOverlay = { position: 'fixed' as any, inset: 0, background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const modalBox = { background: 'white', padding: '40px', borderRadius: '24px', width: '400px', textAlign: 'center' as any, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const modalInput = { fontSize: '2.5rem', width: '100%', textAlign: 'center' as any, margin: '20px 0', borderRadius: '15px', border: '2px solid #6366f1', letterSpacing: '8px', fontWeight: 900, color: '#6366f1', outline: 'none' };
const cancelBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' };
const confirmBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer' };