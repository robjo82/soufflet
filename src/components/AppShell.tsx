import { BookOpen, Gauge, Home, Library, Menu, Mic2, Music2, Settings, Sparkles, UserRound, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../types';

interface AppShellProps {
  page: Page;
  children: React.ReactNode;
  onNavigate: (page: Page) => void;
}

const NAV: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'learn', label: 'Apprendre', icon: BookOpen },
  { id: 'library', label: 'Bibliothèque', icon: Library },
  { id: 'studio', label: 'Studio', icon: Music2 },
  { id: 'tuner', label: 'Accordeur', icon: Gauge },
];

export function AppShell({ page, children, onNavigate }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (target: Page) => { onNavigate(target); setMobileOpen(false); };
  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        <button type="button" className="brand-lockup" onClick={() => navigate('home')}><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></button>
        <nav className={mobileOpen ? 'is-open' : ''}>
          {NAV.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => navigate(id)} className={page === id ? 'is-active' : ''}><Icon />{label}</button>)}
        </nav>
        <div className="topbar-actions"><button type="button" className="streak-pill" title="Série d’entraînement"><Sparkles /> <strong>3</strong><span>jours</span></button><button type="button" className="icon-button" onClick={() => navigate('settings')} aria-label="Réglages"><Settings /></button><button type="button" className="avatar-button" aria-label="Profil"><UserRound /></button></div>
      </header>
      {children}
      <footer className="site-footer"><span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span><p>Conçu pour apprendre lentement, jouer longtemps.</p><nav><button type="button" onClick={() => navigate('settings')}><Wrench /> Instrument</button><span><Mic2 /> Audio analysé localement</span></nav></footer>
    </div>
  );
}
