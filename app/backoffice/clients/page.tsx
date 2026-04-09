"use client";
import { useEffect, useState } from 'react';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);

  // On simule quelques clients pour le design, ou on les récupère si tu as une DB
  useEffect(() => {
    const datafictive = [
      { id: 1, nom: "Jean Dupont", email: "jean@gmail.com", source: "Amazon", totalAchat: "145.00 €", date: "08/04/2026" },
      { id: 2, nom: "Marie Curie", email: "m.curie@yahoo.fr", source: "Shopify", totalAchat: "89.90 €", date: "07/04/2026" },
      { id: 3, nom: "Lucas Martin", email: "l.martin@outlook.com", source: "Shopify", totalAchat: "210.00 €", date: "05/04/2026" },
    ];
    setClients(datafictive);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>Base Clients</h1>
        <button style={{ background: '#6366f1', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
          Exporter (.csv)
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '15px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
              <th style={{ padding: '15px' }}>CLIENT</th>
              <th style={{ padding: '15px' }}>SOURCE</th>
              <th style={{ padding: '15px' }}>DERNIER ACHAT</th>
              <th style={{ padding: '15px' }}>TOTAL DÉPENSÉ</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '15px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.nom}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.email}</div>
                </td>
                <td style={{ padding: '15px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    background: c.source === 'Amazon' ? '#ffeddb' : '#e1f5fe',
                    color: c.source === 'Amazon' ? '#ff9900' : '#039be5'
                  }}>
                    {c.source}
                  </span>
                </td>
                <td style={{ padding: '15px', fontSize: '0.85rem', color: '#475569' }}>{c.date}</td>
                <td style={{ padding: '15px', fontWeight: 700, color: '#1e293b' }}>{c.totalAchat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', padding: '20px', background: '#f1f5f9', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
          💡 <strong>Astuce IA :</strong> Vos clients Shopify dépensent en moyenne 15% de plus que vos clients Amazon.
        </p>
      </div>
    </div>
  );
}