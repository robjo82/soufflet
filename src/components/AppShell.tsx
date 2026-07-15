import { BookOpen, ChevronDown, Gauge, Home, Library, LogOut, Menu, Mic2, Music2, Settings, Sparkles, UserRound, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Page, PracticeStats, UserAccount } from '../types';

interface AppShellProps {
  page: Page;
  children: React.ReactNode;
  onNavigate: (page: Page) => void;
  user: UserAccount;
  practiceStats: PracticeStats | null;
  onLogout: () => void;
}

const NAV: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'learn', label: 'Apprendre', icon: BookOpen },
  { id: 'library', label: 'Bibliothèque', icon: Library },
  { id: 'studio', label: 'Studio', icon: Music2 },
  { id: 'tuner', label: 'Accordeur', icon: Gauge },
];

export function AppShell({ page, children, onNavigate, user, practiceStats, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenu = useRef<HTMLDivElement>(null);
  const navigate = (target: Page) => { onNavigate(target); setMobileOpen(false); setAccountOpen(false); };
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenu.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeWithKeyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeWithKeyboard);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeWithKeyboard); };
  }, [accountOpen]);
  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        <button type="button" className="brand-lockup" onClick={() => navigate('home')}><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></button>
        <nav className={mobileOpen ? 'is-open' : ''}>
          {NAV.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => navigate(id)} className={page === id ? 'is-active' : ''}><Icon />{label}</button>)}
        </nav>
        <div className="topbar-actions"><button type="button" className="streak-pill" title="Série calculée à partir de tes séances réelles"><Sparkles /> <strong>{practiceStats ? practiceStats.overview.currentStreak : '—'}</strong><span>{practiceStats ? `jour${practiceStats.overview.currentStreak === 1 ? '' : 's'}` : 'suivi'}</span></button><button type="button" className="icon-button" onClick={() => navigate('settings')} aria-label="Réglages"><Settings /></button><div className="account-menu" ref={accountMenu}><button type="button" className={`avatar-button ${page === 'account' ? 'is-active' : ''}`} aria-label={`Ouvrir le compte de ${user.displayName}`} aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><UserRound /><ChevronDown /></button>{accountOpen && <div className="account-popover" role="menu"><header><span><UserRound /></span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></header><button type="button" role="menuitem" onClick={() => navigate('account')}><UserRound /><span><strong>Mon compte</strong><small>Profil, sécurité et matériel</small></span></button><button type="button" role="menuitem" onClick={() => navigate('settings')}><Settings /><span><strong>Réglages</strong><small>Instrument, affichage et audio</small></span></button><button type="button" className="logout-menu-item" role="menuitem" onClick={() => { setAccountOpen(false); onLogout(); }}><LogOut /><span><strong>Se déconnecter</strong><small>Fermer cette session</small></span></button></div>}</div></div>
      </header>
      {children}
      <footer className="site-footer"><span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span><p>Conçu pour apprendre lentement, jouer longtemps.</p><nav><button type="button" onClick={() => navigate('settings')}><Wrench /> Instrument</button><span><Mic2 /> Audio analysé localement</span></nav></footer>
    </div>
  );
}
