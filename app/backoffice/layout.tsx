"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../utils/supabase';

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // États de l'interface
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // États de la sécurité (Popup Code)
  const [showCodePopup, setShowCodePopup] = useState(false);
  const [currentOrgCode, setCurrentOrgCode] = useState("");

  const impersonatedId = typeof window !== 'undefined' ? localStorage.getItem('impersonated_org_id') : null;

  // 1. Récupération de l'utilisateur
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const metadata = session.user.user_metadata;
        setUser({
          id: session.user.id,
          name: metadata.nom || session.user.email,
          role: metadata.role || "Collaborateur",
          initials: (metadata.nom ? metadata.nom.substring(0, 2).toUpperCase() : "US"),
          organisation_id: metadata.organisation_id
        });
      } else if (!impersonatedId) {
        router.push('/login');
      }
    };
    fetchUser();
  }, [router, impersonatedId]);

  // 2. Écoute temps réel pour la demande de maintenance (Correction de la logique)
  useEffect(() => {
    if (!user?.organisation_id) return;

    console.log("📡 Tentative d'écoute Realtime pour l'org:", user.organisation_id);

    const channel = supabase
      .channel(`access-request-${user.organisation_id}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'organisations', 
          filter: `id=eq.${user.organisation_id}` 
      }, (payload) => {
        console.log("⚡ Mise à jour reçue en temps réel:", payload.new);
        if (payload.new.temp_access_code) {
          setCurrentOrgCode(payload.new.temp_access_code);
          setShowCodePopup(true);
        } else {
          setShowCodePopup(false);
          setCurrentOrgCode("");
        }
      })
      .subscribe((status) => {
        console.log("🌐 Statut de la connexion Realtime:", status);
      });

    return () => {
      console.log("🔌 Déconnexion du canal Realtime");
      supabase.removeChannel(channel);
    };
  }, [user?.organisation_id]);

  const navItemStyle = (path: string) => ({
    color: pathname === path ? '#6366f1' : '#64748b',
    background: pathname === path ? '#f1f5f9' : 'transparent',
    textDecoration: 'none', 
    fontWeight: 700, 
    fontSize: '0.85rem', 
    padding: '8px 18px', 
    borderRadius: '25px',
    transition: '0.2s'
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ 
        height: '75px', background: 'white', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '0 40px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flex: 1 }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, minWidth: '100px' }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
          
          <div style={{ position: 'relative', width: '300px' }}>
            <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, fontSize: '0.9rem' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              style={{ width: '100%', padding: '10px 15px 10px 40px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            <Link href="/backoffice/dashboard" style={navItemStyle('/backoffice/dashboard')}>Dashboard</Link>
            <Link href="/backoffice/articles" style={navItemStyle('/backoffice/articles')}>Stock</Link>
            <Link href="/backoffice/ventes" style={navItemStyle('/backoffice/ventes')}>Ventes</Link>
            <Link href="/backoffice/parametres" style={navItemStyle('/backoffice/parametres')}>Paramètres</Link>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
          {impersonatedId && (
            <div onClick={() => { localStorage.removeItem('impersonated_org_id'); window.location.href='/master-admin'; }} 
                 style={{ background: '#f59e0b', color: 'white', padding: '6px 15px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>
              ADMIN MODE
            </div>
          )}

          <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '5px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{user?.name}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1' }}>{user?.role}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              {user?.initials}
            </div>
          </div>

          {isMenuOpen && (
            <div style={{ position: 'absolute', top: '60px', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', width: '220px', overflow: 'hidden' }}>
              <Link href="/backoffice/mon-profil" style={{ display: 'block', padding: '12px 15px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem' }}>👤 Mon Profil</Link>
              <button 
                onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('impersonated_org_id'); window.location.href='/login'; }}
                style={{ width: '100%', textAlign: 'left', padding: '12px 15px', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >🚪 Se déconnecter</button>
            </div>
          )}
        </div>
      </nav>

      <main style={{ padding: '40px', marginTop: '75px' }}>
        {children}
      </main>

      {/* POPUP DE CODE (Apparaît quand le Master Admin demande l'accès) */}
      {showCodePopup && (
        <div style={{ 
          position: 'fixed', bottom: '20px', right: '20px', background: 'white', 
          padding: '25px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', 
          zIndex: 9999, border: '2px solid #6366f1', width: '300px'
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>🔐 <strong>Support CRM AI</strong></div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>
            Un administrateur demande l'accès à votre vue pour maintenance. Fournissez ce code :
          </p>
          <div style={{ 
            fontSize: '2.5rem', fontWeight: 900, textAlign: 'center', color: '#6366f1', 
            letterSpacing: '5px', margin: '20px 0', background: '#f1f5f9', 
            padding: '10px', borderRadius: '12px' 
          }}>
            {currentOrgCode}
          </div>
          <button 
            onClick={async () => {
              await supabase.from('organisations').update({ temp_access_code: null }).eq('id', user.organisation_id);
              setShowCodePopup(false);
            }}
            style={{ width: '100%', background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
          >
            Refuser l'accès
          </button>
        </div>
      )}
    </div>
  );
}