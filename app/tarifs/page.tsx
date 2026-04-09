"use client";
export default function Pricing() {
  const plans = [
    { name: "Starter", price: "29€", features: ["1 Utilisateur", "50 Produits", "Support Email"] },
    { name: "Pro", price: "79€", features: ["5 Utilisateurs", "Produits Illimités", "Gestion Clients", "Factures PDF"] },
    { name: "Enterprise", price: "199€", features: ["Utilisateurs Illimités", "IA Prédictive", "Multi-Dépôts", "API Marketplaces"] }
  ];

  return (
    <div style={{ textAlign: 'center', padding: '100px 20px', background: '#f8fafc' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>Choisissez la puissance de votre commerce</h1>
      <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', marginTop: '50px' }}>
        {plans.map(plan => (
          <div key={plan.name} style={{ background: 'white', padding: '40px', borderRadius: '30px', width: '300px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#6366f1' }}>{plan.name}</h2>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '20px 0' }}>{plan.price}<small style={{ fontSize: '1rem', color: '#64748b' }}>/mois</small></div>
            <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', marginBottom: '30px' }}>
              {plan.features.map(f => <li key={f} style={{ marginBottom: '10px' }}>✅ {f}</li>)}
            </ul>
            <button style={{ width: '100%', background: '#1e293b', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Commencer l'essai gratuit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}