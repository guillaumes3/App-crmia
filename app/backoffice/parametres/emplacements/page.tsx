"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';

export default function EmplacementsPage() {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [emplacementList, setEmplacementList] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState({ nom: '', type: 'depot', description: '', capacite: 0 });

  const loadData = useCallback(async (id: string) => {
    const { data } = await supabase.from('emplacements').select('*').eq('organisation_id', id).order('nom');
    if (data) setEmplacementList(data);
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
    const { error } = await supabase.from('emplacements').insert([{ ...newEmp, organisation_id: orgId }]);
    if (!error) {
      setNewEmp({ nom: '', type: 'depot', description: '', capacite: 0 });
      setShowAdd(false);
      loadData(orgId);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet emplacement ?')) return;
    await supabase.from('emplacements').delete().eq('id', id);
    loadData(orgId);
  };

  return (
    <div style={viewCard}>
      <header style={cardHeader}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Dépôts et Zones de Stockage</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={submitBtn}>
          {showAdd ? 'Annuler' : '+ Nouvel emplacement'}
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleCreate} style={inlineFormBox}>
          <div style={grid2}>
            <input style={inS} placeholder="Nom du dépôt" value={newEmp.nom} onChange={e => setNewEmp({...newEmp, nom: e.target.value})} required />
            <select style={inS} value={newEmp.type} onChange={e => setNewEmp({...newEmp, type: e.target.value})}>
              <option value="depot">Dépôt</option>
              <option value="zone">Zone</option>
              <option value="rayon">Rayon</option>
            </select>
          </div>
          <button type="submit" disabled={loading} style={{...submitBtn, marginTop: '15px'}}>Enregistrer</button>
        </form>
      )}

      <table style={tableS}>
        <thead>
          <tr style={thRow}>
            <th style={thS}>Nom</th>
            <th style={thS}>Type</th>
            <th style={thS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {emplacementList.map(emp => (
            <tr key={emp.id} style={trRow}>
              <td style={tdS}><strong>{emp.nom}</strong></td>
              <td style={tdS}><span style={typeTag(emp.type)}>{emp.type}</span></td>
              <td style={tdS}><button onClick={() => handleDelete(emp.id)} style={dangerBtn}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Styles spécifiques (Inclus pour éviter les erreurs d'import)
const viewCard: React.CSSProperties = { background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const inlineFormBox = { background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const inS = { padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%' };
const submitBtn = { background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' };
const tableS = { width: '100%', borderCollapse: 'collapse' as any };
const thRow = { textAlign: 'left' as any, borderBottom: '2px solid #f1f5f9' };
const thS = { padding: '15px 10px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' as any };
const tdS = { padding: '15px 10px', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' };
const trRow = { transition: '0.2s' };
const dangerBtn = { background: '#fef2f2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' };
const typeTag = (type: string) => ({
  background: type === 'depot' ? '#e0e7ff' : '#dcfce7',
  color: type === 'depot' ? '#4338ca' : '#166534',
  padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700
});