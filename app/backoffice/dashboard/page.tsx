"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { getDashboardStats } from '@/app/services/stats';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isInfiltration, setIsInfiltration] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // 1. Récupération de la session
      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. Vérification du mode infiltration
      const impersonatedId = typeof window !== 'undefined' ? localStorage.getItem('impersonated_org_id') : null;
      
      if (session) {
        setUser(session.user);
        setIsInfiltration(!!impersonatedId);

        // 3. Choix de l'organisation à charger
        const orgIdToUse = impersonatedId || session.user.user_metadata.organisation_id;
        
        if (orgIdToUse) {
          const data = await getDashboardStats(orgIdToUse);
          setStats(data);
        }
      }
    };
    loadData();
  }, []);

  // Styles réutilisables
  const cardStyle = {
    background: '#FFFFFF',
    padding: '32px',
    borderRadius: '24px',
    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.02)',
    flex: 1,
    transition: 'transform 0.2s ease'
  };

  const labelStyle = {
    color: '#8E8E93',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '16px'
  };

  const valueStyle = {
    fontSize: '2.8rem',
    fontWeight: 800,
    color: '#000'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* HEADER */}
      <header style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1A1A1A', letterSpacing: '-1px', marginBottom: '8px' }}>
          Tableau de bord
        </h1>
        <p style={{ color: '#8E8E93', fontSize: '1.1rem', fontWeight: 500 }}>
          {isInfiltration 
            ? "✦ Mode Maintenance Expert" 
            : `Ravi de vous revoir, ${user?.user_metadata?.nom || 'Gérant'}`
          }
        </p>
      </header>

      {/* GRILLE DE STATISTIQUES */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '48px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Articles</div>
          <div style={valueStyle}>{stats?.nbProduits || 0}</div>
          <div style={{ marginTop: '8px', color: '#34C759', fontSize: '0.9rem', fontWeight: 600 }}>↑ +2 ce jour</div>
        </div>
        
        <div style={cardStyle}>
          <div style={labelStyle}>Valeur Stock</div>
          <div style={valueStyle}>
            {stats?.valeurStock || "0.00"}
            <span style={{ fontSize: '1.5rem', marginLeft: '4px' }}>€</span>
          </div>
          <div style={{ marginTop: '8px', color: '#8E8E93', fontSize: '0.9rem' }}>Actif circulant</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Ventes mensuelles</div>
          <div style={valueStyle}>{stats?.nbVentes || 0}</div>
          <div style={{ marginTop: '8px', color: '#FF9500', fontSize: '0.9rem', fontWeight: 600 }}>En attente de données</div>
        </div>
      </div>

      {/* BANNIÈRE IA ANALYTICS */}
      <div style={{ 
        background: '#000000', 
        padding: '40px', 
        borderRadius: '32px', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>🧠 Analyse Prédictive</h3>
          <p style={{ color: '#A1A1A6', fontSize: '1rem', lineHeight: '1.6', maxWidth: '600px' }}>
            {(!stats || stats?.nbProduits < 5) 
              ? "Votre inventaire est actuellement limité. L'IA suggère d'ajouter au moins 10 références pour optimiser vos futures prédictions de vente."
              : "Analyse terminée : Vos niveaux de stock sont optimaux pour absorber la demande des 14 prochains jours."}
          </p>
        </div>
        <button style={{ 
          background: 'white', color: 'black', border: 'none', padding: '14px 28px', 
          borderRadius: '14px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          transition: '0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          Optimiser maintenant
        </button>
      </div>

    </div>
  );
}