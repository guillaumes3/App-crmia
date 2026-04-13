"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../utils/supabase';
import { getOrganisationId, isKipiloteStaff } from '@/app/types/auth';
import { setActiveUniverse } from '@/app/utils/universeState';
import { hasPermission, resolveAppRole, type AppRole, type PermissionKey } from '@/app/security/permissions';

type BackOfficeUser = {
  name: string;
  role: AppRole;
  initials: string;
};

type NavigationItem = {
  label: string;
  path: string;
  requiredPermission: PermissionKey;
};

const MOBILE_BREAKPOINT = 1024;

const NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard', path: '/backoffice/dashboard', requiredPermission: 'CAN_VIEW_DASHBOARD' },
  { label: 'Stock', path: '/backoffice/articles', requiredPermission: 'CAN_VIEW_STOCK' },
  { label: 'Fournisseurs', path: '/backoffice/fournisseurs', requiredPermission: 'CAN_VIEW_SUPPLIERS' },
  { label: 'Commandes', path: '/backoffice/commandes', requiredPermission: 'CAN_VIEW_ORDERS' },
  { label: 'Clients', path: '/backoffice/clients', requiredPermission: 'CAN_VIEW_CLIENTS' },
  { label: 'Ventes', path: '/backoffice/ventes', requiredPermission: 'CAN_VIEW_SALES' },
  { label: 'Parametres', path: '/backoffice/parametres', requiredPermission: 'CAN_MANAGE_USERS' },
];

const buildInitials = (name?: string, fallback = 'US'): string => {
  if (!name) {
    return fallback;
  }

  const words = name
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return fallback;
  }

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return initials || fallback;
};

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<BackOfficeUser | null>(null);
  const [organisationName, setOrganisationName] = useState<string>('Votre entreprise');
  const [isHqStaffUser, setIsHqStaffUser] = useState(false);
  const [isMaintenanceBlocked, setIsMaintenanceBlocked] = useState(false);
  const [maintenanceOrgName, setMaintenanceOrgName] = useState<string>('');
  const [isMaintenanceSession, setIsMaintenanceSession] = useState(false);

  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth >= MOBILE_BREAKPOINT;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [isLogoutHovered, setIsLogoutHovered] = useState(false);

  useEffect(() => {
    const syncViewport = () => {
      const nextIsDesktop = window.innerWidth >= MOBILE_BREAKPOINT;
      setIsDesktop(nextIsDesktop);
      if (nextIsDesktop) {
        setIsDrawerOpen(false);
      }
    };

    const frameId = window.requestAnimationFrame(syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      if (isKipiloteStaff(session.user)) {
        setIsHqStaffUser(true);
        setActiveUniverse('hq');
        router.replace('/hq/staff');
        return;
      }

      setIsHqStaffUser(false);
      setActiveUniverse('client');

      const metadata = session.user.user_metadata;
      const name = metadata.nom || session.user.email || 'Utilisateur';
      const organisationId = getOrganisationId(session.user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_user_id', session.user.id)
        .maybeSingle<{ role?: string | null }>();
      const resolvedRole = resolveAppRole(profile?.role ?? metadata.role);

      setUser({
        name,
        role: resolvedRole,
        initials: buildInitials(metadata.nom, 'US'),
      });

      setIsMaintenanceSession(false);
      if (!organisationId) {
        router.replace('/404');
        return;
      }

      const { data: organisation } = await supabase
        .from('organisations')
        .select('nom, maintenance_mode')
        .eq('id', organisationId)
        .single();

      setOrganisationName(organisation?.nom || 'Votre entreprise');

      if (organisation?.maintenance_mode) {
        setIsMaintenanceBlocked(true);
        setMaintenanceOrgName(organisation.nom || 'Cette entreprise');
        return;
      }

      setIsMaintenanceBlocked(false);
      setMaintenanceOrgName('');
    };

    fetchUser();
  }, [router]);

  const isActivePath = (path: string): boolean => pathname === path || pathname.startsWith(`${path}/`);
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(user?.role ?? 'Vendeur', item.requiredPermission)),
    [user?.role],
  );

  const closeDrawer = () => setIsDrawerOpen(false);

  const handleNavItemClick = () => {
    if (!isDesktop) {
      setIsDrawerOpen(false);
    }
  };

  const handleLogout = async () => {
    closeDrawer();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const quitMaintenanceSession = () => {
    closeDrawer();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('impersonated_org_id');
      localStorage.removeItem('maintenance_override');
      localStorage.removeItem('maintenance_org_id');
    }

    router.push('/master-admin');
  };

  const logoutButtonStyle: React.CSSProperties = useMemo(
    () => ({
      border: '1px solid rgba(226,232,240,0.35)',
      background: isLogoutHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
      color: '#ffffff',
      borderRadius: '12px',
      padding: '10px 14px',
      fontWeight: 800,
      fontSize: '0.8rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(4px)',
    }),
    [isLogoutHovered],
  );

  const navItemStyle = (path: string, compact = false): React.CSSProperties => {
    const active = isActivePath(path);
    const hovered = hoveredPath === path;

    return {
      color: '#ffffff',
      textDecoration: 'none',
      fontWeight: 800,
      fontSize: compact ? '0.95rem' : '0.86rem',
      letterSpacing: '0.01em',
      padding: compact ? '12px 14px' : '10px 12px',
      borderRadius: compact ? '12px' : '10px',
      background: active ? 'rgba(255,255,255,0.18)' : hovered ? 'rgba(255,255,255,0.1)' : 'transparent',
      border: active || hovered ? '1px solid rgba(226,232,240,0.35)' : '1px solid transparent',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
    };
  };

  if (isHqStaffUser) {
    return (
      <div style={hqGuardWrapStyle}>
        <div style={hqModeBannerStyle}>MODE MAISON MERE</div>
        <p style={hqGuardTextStyle}>Compte HQ detecte. Le menu client est bloque pour eviter tout melange de donnees.</p>
        <button type="button" style={hqGuardButtonStyle} onClick={() => router.replace('/hq/staff')}>
          Ouvrir le portail HQ
        </button>
      </div>
    );
  }

  if (isMaintenanceBlocked) {
    return (
      <div style={maintenanceWrapStyle}>
        <div style={maintenanceCardStyle}>
          <h1 style={maintenanceTitleStyle}>Maintenance en cours</h1>
          <p style={maintenanceTextStyle}>
            {maintenanceOrgName} est temporairement indisponible pour maintenance. L&apos;acces est restreint pendant cette operation.
          </p>
          <button onClick={handleLogout} style={maintenanceLogoutStyle}>
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapStyle}>
      <header style={headerStyle}>
        <div style={brandWrapStyle}>
          <button type="button" onClick={() => router.push('/backoffice/dashboard')} style={logoStyle}>
            KIPILOTE<span style={logoDotStyle}>.</span>
          </button>
          <span style={organisationBadgeStyle}>{organisationName}</span>
        </div>

        {isDesktop ? (
          <div style={desktopRightZoneStyle}>
            <nav style={desktopNavStyle}>
              {visibleNavItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  style={navItemStyle(item.path)}
                  onClick={handleNavItemClick}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath((current) => (current === item.path ? null : current))}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div style={profileZoneStyle}>
              {isMaintenanceSession && (
                <button type="button" onClick={quitMaintenanceSession} style={maintenanceExitStyle}>
                  Quitter maintenance
                </button>
              )}

              <div style={userIdentityStyle}>
                <div style={avatarStyle}>{user?.initials || 'US'}</div>
                <div style={userTextStyle}>
                  <div style={userNameStyle}>{user?.name || 'Utilisateur'}</div>
                  <div style={userRoleStyle}>{user?.role || 'Vendeur'}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={logoutButtonStyle}
                onMouseEnter={() => setIsLogoutHovered(true)}
                onMouseLeave={() => setIsLogoutHovered(false)}
              >
                Deconnexion
              </button>
            </div>
          </div>
        ) : (
          <div style={mobileHeaderActionsStyle}>
            <div style={mobileAvatarStyle}>{user?.initials || 'US'}</div>
            <button
              type="button"
              aria-label={isDrawerOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              style={burgerButtonStyle}
            >
              {isDrawerOpen ? '✕' : '☰'}
            </button>
          </div>
        )}
      </header>

      {!isDesktop && isDrawerOpen && <button type="button" aria-label="Fermer le menu" style={drawerOverlayStyle} onClick={closeDrawer} />}

      {!isDesktop && (
        <aside style={drawerStyle(isDrawerOpen)}>
          <div style={drawerTopStyle}>
            <span style={organisationBadgeStyle}>{organisationName}</span>
            <div style={drawerUserRowStyle}>
              <div style={avatarStyle}>{user?.initials || 'US'}</div>
              <div style={userTextStyle}>
                <div style={userNameStyle}>{user?.name || 'Utilisateur'}</div>
                <div style={userRoleStyle}>{user?.role || 'Vendeur'}</div>
              </div>
            </div>

            <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
              Deconnexion
            </button>

            {isMaintenanceSession && (
              <button type="button" onClick={quitMaintenanceSession} style={maintenanceExitMobileStyle}>
                Quitter maintenance
              </button>
            )}
          </div>

          <nav style={drawerNavStyle}>
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                style={navItemStyle(item.path, true)}
                onClick={handleNavItemClick}
                onMouseEnter={() => setHoveredPath(item.path)}
                onMouseLeave={() => setHoveredPath((current) => (current === item.path ? null : current))}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
      )}

      <main style={mainStyle(isDesktop)}>{children}</main>
    </div>
  );
}

const pageWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#eef2ff',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1200,
  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  borderBottom: '1px solid rgba(226,232,240,0.15)',
  minHeight: '76px',
  padding: '0 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '20px',
  boxShadow: '0 16px 32px -25px rgba(15, 23, 42, 0.28)',
};

const logoStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  fontSize: '1.45rem',
  fontWeight: 800,
  letterSpacing: '-0.06em',
  color: '#ffffff',
};

const logoDotStyle: React.CSSProperties = {
  color: '#a5b4fc',
};

const brandWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
};

const organisationBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(226,232,240,0.35)',
  background: 'rgba(255,255,255,0.1)',
  color: '#ffffff',
  borderRadius: '999px',
  padding: '6px 12px',
  fontSize: '0.74rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
  maxWidth: '220px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const desktopRightZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '16px',
  flex: 1,
};

const desktopNavStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '2px',
  flexWrap: 'nowrap',
};

const profileZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  borderLeft: '1px solid rgba(226,232,240,0.2)',
  paddingLeft: '12px',
};

const userIdentityStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const avatarStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #312e81, #4338ca)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '0.82rem',
  flexShrink: 0,
};

const userTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.1,
};

const userNameStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '0.8rem',
  fontWeight: 700,
  maxWidth: '160px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const userRoleStyle: React.CSSProperties = {
  color: '#c7d2fe',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const mobileHeaderActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const mobileAvatarStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #312e81, #4338ca)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '0.78rem',
};

const burgerButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(226,232,240,0.35)',
  background: 'rgba(255,255,255,0.08)',
  color: '#ffffff',
  borderRadius: '10px',
  width: '42px',
  height: '42px',
  fontSize: '1.25rem',
  lineHeight: 1,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const drawerOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1250,
  border: 'none',
  margin: 0,
  padding: 0,
  background: 'rgba(15, 23, 42, 0.35)',
  cursor: 'pointer',
};

const drawerStyle = (open: boolean): React.CSSProperties => ({
  position: 'fixed',
  top: 0,
  right: 0,
  width: 'min(82vw, 320px)',
  height: '100vh',
  background: '#0f172a',
  boxShadow: '-10px 0 35px rgba(15, 23, 42, 0.2)',
  borderLeft: '1px solid rgba(226,232,240,0.25)',
  zIndex: 1300,
  transform: open ? 'translateX(0)' : 'translateX(102%)',
  transition: 'transform 0.25s ease',
  display: 'flex',
  flexDirection: 'column',
  padding: '18px',
  gap: '18px',
});

const drawerTopStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  borderBottom: '1px solid rgba(226,232,240,0.2)',
  paddingBottom: '14px',
};

const drawerUserRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const drawerNavStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  overflowY: 'auto',
};

const mainStyle = (desktop: boolean): React.CSSProperties => ({
  padding: desktop ? '28px 32px 38px 32px' : '22px 14px 30px 14px',
});

const maintenanceWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const maintenanceCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 20px 45px -30px rgba(15,23,42,0.35)',
};

const maintenanceTitleStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: '10px',
};

const maintenanceTextStyle: React.CSSProperties = {
  color: '#475569',
  lineHeight: 1.6,
  marginBottom: '18px',
};

const maintenanceLogoutStyle: React.CSSProperties = {
  border: 'none',
  background: '#111827',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const maintenanceExitStyle: React.CSSProperties = {
  border: '1px solid #dbe3ee',
  background: '#ffffff',
  color: '#0f172a',
  borderRadius: '10px',
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: '0.76rem',
  cursor: 'pointer',
};

const maintenanceExitMobileStyle: React.CSSProperties = {
  border: '1px solid #dbe3ee',
  background: '#ffffff',
  color: '#0f172a',
  borderRadius: '10px',
  padding: '10px 12px',
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const hqGuardWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '14px',
  padding: '20px',
};

const hqModeBannerStyle: React.CSSProperties = {
  border: '1px solid #facc15',
  background: '#fef9c3',
  color: '#713f12',
  borderRadius: '999px',
  padding: '8px 16px',
  fontSize: '0.82rem',
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const hqGuardTextStyle: React.CSSProperties = {
  color: '#475569',
  margin: 0,
  textAlign: 'center',
  maxWidth: '520px',
};

const hqGuardButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#1e293b',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};
