"use client";
import { useState, useEffect } from 'react';
// OU selon ta config :
import { supabase } from '@/app/utils/supabase';

export default function FiscalitePage() {
  const [tvaConfig, setTvaConfig] = useState({ 
    taux_standard: 20, 
    taux_reduit: 10, 
    taux_super_reduit: 5.5 
  });
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.organisation_id) {
        const id = session.user.user_metadata.organisation_id;
        setOrgId(id);
        const { data } = await supabase
          .from('tva_config')
          .select('*')
          .eq('organisation_id', id)
          .single();
        
        if (data) {
          setTvaConfig({ 
            taux_standard: data.taux_standard, 
            taux_reduit: data.taux_reduit, 
            taux_super_reduit: data.taux_super_reduit 
          });
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!orgId) return alert("Session expou organisation manquante.");
    setLoading(true);
    
    const { error } = await supabase
      .from('tva_config')
      .upsert({ 
        organisation_id: orgId, 
        taux_standard: tvaConfig.taux_standard,
        taux_reduit: tvaConfig.taux_reduit,
        taux_super_reduit: tvaConfig.taux_super_reduit
      }, { onConflict: 'organisation_id' });

    setLoading(false);
    if (error) alert(error.message);
    else alert("TVA mise à jour avec succès.");
  };

  return (
    <div style={viewCard}>
      <header style={cardHeader}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Configuration de la TVA</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
          Définissez les taux applicables à vos transactions.
        </p>
      </header>

      <div style={tvaGrid}>
        <div style={inputBox}>
          <label style={labelS}>Taux Standard (%)</label>
          <input 
            style={inS} 
            type="number" 
            step="0.01"
            value={tvaConfig.taux_standard} 
            onChange={e => setTvaConfig({...tvaConfig, taux_standard: parseFloat(e.target.value) || 0})} 
          />
        </div>
        <div style={inputBox}>
          <label style={labelS}>Taux Réduit (%)</label>
          <input 
            style={inS} 
            type="number" 
            step="0.01"
            value={tvaConfig.taux_reduit} 
            onChange={e => setTvaConfig({...tvaConfig, taux_reduit: parseFloat(e.target.value) || 0})} 
          />
        </div>
        <div style={inputBox}>
          <label style={labelS}>Taux Super Réduit (%)</label>
          <input 
            style={inS} 
            type="number" 
            step="0.01"
            value={tvaConfig.taux_super_reduit} 
            onChange={e => setTvaConfig({...tvaConfig, taux_super_reduit: parseFloat(e.target.value) || 0})} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={loading} style={submitBtn}>
          {loading ? 'Enregistrement...' : 'Enregistrer les taux'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// STYLES (Objets de style intégrés pour éviter les erreurs)
// ============================================================

const viewCard: React.CSSProperties = {
  background: 'white',
  padding: '30px',
  borderRadius: '20px',
  border: '1px solid #e2e8f0',
};

const cardHeader: React.CSSProperties = {
  marginBottom: '25px',
  paddingBottom: '15px',
  borderBottom: '1px solid #f1f5f9',
};

const tvaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '20px',
  marginBottom: '20px',
};

const inputBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
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
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  outline: 'none',
  fontSize: '0.9rem',
  background: '#f8fafc',
};

const submitBtn: React.CSSProperties = {
  marginTop: '25px',
  background: '#0f172a',
  color: 'white',
  border: 'none',
  padding: '12px 25px',
  borderRadius: '10px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: '0.2s',
};