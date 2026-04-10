"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ParametresLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuConfig = [
    { label: 'Collaborateurs', path: '/backoffice/parametres/collaborateurs' },
    { label: 'Rôles & Permissions', path: '/backoffice/parametres/roles' },
    { label: 'Fiscalité', path: '/backoffice/parametres/fiscalite' },
    { label: 'Catégories', path: '/backoffice/parametres/categories' },
    { label: 'Emplacements', path: '/backoffice/parametres/emplacements' },
  ];

  return (
    <div style={{ padding: '30px' }}>
      <h1 style={{ fontWeight: 900, marginBottom: '25px', fontSize: '1.8rem' }}>
        Configuration Kipilote
      </h1>

      <nav style={subNavBar}>
        {menuConfig.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            style={menuButtonStyle(pathname === item.path)}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: '25px' }}>
        {children}
      </div>
    </div>
  );
}

const subNavBar: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  background: 'white',
  padding: '10px',
  borderRadius: '15px',
  border: '1px solid #e2e8f0',
  marginBottom: '25px',
};

const menuButtonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#6366f1' : 'transparent',
  color: active ? 'white' : '#475569',
  textDecoration: 'none',
  padding: '10px 20px',
  borderRadius: '10px',
  fontWeight: 700,
  fontSize: '0.9rem',
  transition: '0.2s',
});