"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../utils/supabase';

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const metadata = session.user.user_metadata;
        setUser({
          name: metadata.nom || session.user.email,
          role: metadata.role || "Collaborateur",
          initials: (metadata.nom ? metadata.nom.substring(0, 2).toUpperCase() : "US"),
        });
      } else {
        router.push('/login');
      }
    };
    fetchUser();
  }, [router]);

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
      {/* BARRE DE NAVIGATION KIPILOTE */}
      <nav style={{ 
        height: '75px', background: 'white', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '0 40px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '50px' }}>
          {/* LOGO MIS À JOUR */}
          <div style={{ fontSize: '1.5rem', fontWeight: 950, letterSpacing: '-1.5px', cursor: 'pointer' }} onClick={() => router.push('/backoffice/dashboard')}>
            KIPILOTE<span style={{ color: '#6366f1' }}>.</span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/backoffice/dashboard" style={navItemStyle('/backoffice/dashboard')}>Dashboard</Link>
            <Link href="/backoffice/articles" style={navItemStyle('/backoffice/articles')}>Stock</Link>
            <Link href="/backoffice/commandes" style={navItemStyle('/backoffice/commandes')}>Commandes</Link>
            <Link href="/backoffice/clients" style={navItemStyle('/backoffice/clients')}>Clients</Link>
            <Link href="/backoffice/ventes" style={navItemStyle('/backoffice/ventes')}>Ventes</Link>
            <Link href="/backoffice/parametres" style={navItemStyle('/backoffice/parametres')}>Paramètres</Link>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{user?.name}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase' }}>{user?.role}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              {user?.initials}
            </div>
          </div>

          {isMenuOpen && (
            <div style={{ position: 'absolute', top: '60px', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', width: '200px', overflow: 'hidden' }}>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 15px', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>🚪 Se déconnecter</button>
            </div>
          )}
        </div>
      </nav>

      <main style={{ padding: '40px', marginTop: '75px' }}>
        {children}
      </main>
    </div>
  );
}
