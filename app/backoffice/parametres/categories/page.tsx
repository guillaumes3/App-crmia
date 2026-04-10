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
    if (!confirm('Confirmer la suppression de cette catégorie ?')) return;
    await supabase.from('categories').delete().eq('id', id);
    loadData(orgId);
  };

  return (
    <div style={viewCard}>
      <header style={cardHeader}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Classification des Articles</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={submitBtn}>
          {showAdd ? 'Annuler' : 'Nouvelle catégorie'}
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleCreate} style={inlineFormBox}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
            <div>
              <label style={labelS}>Nom de la catégorie</label>
              <input style={inS} placeholder="Exemple: Électronique, Textile..." value={newCat.nom} onChange={e => setNewCat({...newCat, nom: e.target.value})} required />
            </div>
            <div>
              <label style={labelS}>Couleur</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" value={newCat.couleur} onChange={e => setNewCat({...newCat, couleur: e.target.value})} style={{ height: '40px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{newCat.couleur}</span>
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{...submitBtn, marginTop: '15px', width: '100%'}}>Enregistrer la catégorie</button>
        </form>
      )}

      <table style={tableS}>
        <thead>
          <tr style={thRow}>
            <th style={thS}>Repère</th>
            <th style={thS}>Désignation</th>
            <th style={thS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categorieList.length === 0 ? (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Aucune catégorie configurée.</td></tr>
          ) : (
            categorieList.map(cat => (
              <tr key={cat.id} style={trRow}>
                <td style={tdS}><div style={{ width: '24px', height: '24px', borderRadius: '6px', background: cat.couleur }} /></td>
                <td style={tdS}><strong>{cat.nom}</strong></td>
                <td style={tdS}><button onClick={() => handleDelete(cat.id)} style={dangerBtn}>Supprimer</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}