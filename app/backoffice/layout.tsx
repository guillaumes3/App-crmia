"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Simulation utilisateur (À lier plus tard à ton authentification)
  const user = { name: "Guillaume S.", role: "Administrateur", initials: "GS" };

  const navItemStyle = (path: string) => ({
    color: pathname === path ? '#6366f1' : '#64748b',
    background: pathname === path ? '#f1f5f9' : 'transparent',
    textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', padding: '8px 18px', borderRadius: '25px',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ 
        height: '70px', background: 'white', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '0 40px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>CRM<span style={{ color: '#6366f1' }}>AI</span></div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <Link href="/backoffice/dashboard" style={navItemStyle('/backoffice/dashboard')}>Dashboard</Link>
            <Link href="/backoffice/articles" style={navItemStyle('/backoffice/articles')}>Stock</Link>
            <Link href="/backoffice/ventes" style={navItemStyle('/backoffice/ventes')}>Ventes</Link>
            <Link href="/backoffice/clients" style={navItemStyle('/backoffice/clients')}>Clients</Link>
            <Link href="/backoffice/parametres" style={navItemStyle('/backoffice/parametres')}>Paramètres</Link>
          </div>
        </div>

        {/* PROFIL AVEC MENU BURGER */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '5px 10px', borderRadius: '12px', transition: '0.2s' }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{user.name}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1' }}>{user.role}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              {user.initials}
            </div>
          </div>

          {/* MENU DÉROULANT (BURGER) */}
          {isMenuOpen && (
            <div style={{ position: 'absolute', top: '55px', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '200px', overflow: 'hidden', zIndex: 1100 }}>
              <Link href="/backoffice/mon-profil" onClick={() => setIsMenuOpen(false)} style={{ display: 'block', padding: '12px 15px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                👤 Mon Profil
              </Link>
              <button 
                onClick={() => window.location.href = '/login'}
                style={{ width: '100%', textAlign: 'left', padding: '12px 15px', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                🚪 Se déconnecter
              </button>
            </div>
          )}
        </div>
      </nav>
      <main style={{ padding: '30px', marginTop: '70px' }}>{children}</main>
    </div>
  );
}