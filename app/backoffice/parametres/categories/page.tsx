"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';

export default function CategoriesPage() {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ nom: '', description: '', couleur: '#6366f1' });

  const loadData = useCallback(async (id: string) => {
    const { data } = await supabase.from('categories').select('*').eq('organisation_id', id).order('nom');
    if (data) setCategorieList(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.organisation_id) {
        setOrgId(session.user.user_metadata.organisation_id);
        loadData(session.user.user_metadata.organisation_id);
      }
    };
    init();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('categories').insert([{ ...newCat, organisation_id: orgId }]);
    if (!error) {
      setNewCat({ nom: '', description: '', couleur: '#6366f1' });
      setShowAdd(false);
      loadData(orgId);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    await supabase.from('categories').delete().eq('id', id);
    loadData(orgId);
  };

  return (
    <div style={viewCard}>
      <header style={cardHeader}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Gestion des Catégories</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={submitBtn}>{showAdd ? 'Annuler' : '+ Nouvelle catégorie'}</button>
      </header>

      {showAdd && (
        <form onSubmit={handleCreate} style={inlineFormBox}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
            <input style={inS} placeholder="Nom de la catégorie" value={newCat.nom} onChange={e => setNewCat({...newCat, nom: e.target.value})} required />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" value={newCat.couleur} onChange={e => setNewCat({...newCat, couleur: e.target.value})} style={{ height: '40px', cursor: 'pointer', border: 'none', background: 'none' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{newCat.couleur}</span>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{...submitBtn, marginTop: '15px', width: '100%'}}>Enregistrer</button>
        </form>
      )}

      <table style={tableS}>
        <thead>
          <tr style={thRow}>
            <th style={thS}>Couleur</th>
            <th style={thS}>Nom</th>
            <th style={thS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categorieList.map(cat => (
            <tr key={cat.id} style={trRow}>
              <td style={tdS}><div style={{ width: '24px', height: '24px', borderRadius: '6px', background: cat.couleur }} /></td>
              <td style={tdS}><strong>{cat.nom}</strong></td>
              <td style={tdS}><button onClick={() => handleDelete(cat.id)} style={dangerBtn}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// STYLES (DÉFINIS EXPLICITEMENT POUR LE BUILD VERCEL)
// ============================================================

const viewCard: React.CSSProperties = { 
  background: 'white', 
  padding: '30px', 
  borderRadius: '20px', 
  border: '1px solid #e2e8f0' 
};

const cardHeader: React.CSSProperties = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: '25px' 
};

const inlineFormBox: React.CSSProperties = { 
  background: '#f8fafc', 
  padding: '20px', 
  borderRadius: '15px', 
  marginBottom: '25px',
  border: '1px solid #f1f5f9'
};

const inS: React.CSSProperties = { 
  padding: '12px', 
  borderRadius: '8px', 
  border: '1px solid #e2e8f0', 
  width: '100%',
  outline: 'none'
};

const submitBtn: React.CSSProperties = { 
  background: '#0f172a', 
  color: 'white', 
  border: 'none', 
  padding: '10px 20px', 
  borderRadius: '10px', 
  fontWeight: 700, 
  cursor: 'pointer' 
};

const tableS: React.CSSProperties = { 
  width: '100%', 
  borderCollapse: 'collapse' 
};

const thRow: React.CSSProperties = { 
  textAlign: 'left', 
  borderBottom: '2px solid #f1f5f9' 
};

const thS: React.CSSProperties = { 
  padding: '15px 10px', 
  fontSize: '0.7rem', 
  color: '#94a3b8', 
  fontWeight: 800, 
  textTransform: 'uppercase' 
};

const tdS: React.CSSProperties = { 
  padding: '15px 10px', 
  fontSize: '0.85rem', 
  borderBottom: '1px solid #f1f5f9' 
};

const trRow: React.CSSProperties = { 
  transition: '0.2s' 
};

const dangerBtn: React.CSSProperties = { 
  background: '#fef2f2', 
  color: '#991b1b', 
  border: '1px solid #fecaca', 
  padding: '6px 12px', 
  borderRadius: '8px', 
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.75rem'
};