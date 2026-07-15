import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronRight, Eye, EyeOff, KeyRound, LogOut, Mail, Mic2, Music2, Save, ShieldCheck, UserRound } from 'lucide-react';
import type { AccordionConfig, UserAccount } from '../types';

interface AccountPageProps {
  user: UserAccount;
  accordions: AccordionConfig[];
  selectedAccordionId: string;
  onUserUpdated: (user: UserAccount) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

async function readResponse<T>(response: Response) {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Une erreur est survenue.');
  return payload;
}

export function AccountPage({ user, accordions, selectedAccordionId, onUserUpdated, onOpenSettings, onLogout }: AccountPageProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordState, setPasswordState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [passwordError, setPasswordError] = useState('');
  const instruments = useMemo(() => {
    const selected = accordions.find((accordion) => accordion.id === selectedAccordionId);
    const personal = accordions.filter((accordion) => accordion.id.startsWith('custom-'));
    return [selected, ...personal].filter((accordion, index, items): accordion is AccordionConfig => Boolean(accordion) && items.findIndex((item) => item?.id === accordion?.id) === index);
  }, [accordions, selectedAccordionId]);
  const accountDate = user.createdAt.includes('T') ? user.createdAt : `${user.createdAt.replace(' ', 'T')}Z`;
  const memberSince = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(accountDate));

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setProfileState('saving'); setProfileError('');
    try {
      const payload = await readResponse<{ user: UserAccount }>(await fetch('/api/account/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, email }),
      }));
      onUserUpdated(payload.user); setDisplayName(payload.user.displayName); setEmail(payload.user.email); setProfileState('saved');
      window.setTimeout(() => setProfileState('idle'), 2200);
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Profil impossible à enregistrer.'); setProfileState('idle'); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordError('');
    if (newPassword !== confirmation) { setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.'); return; }
    setPasswordState('saving');
    try {
      await readResponse<{ message: string }>(await fetch('/api/account/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }),
      }));
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setPasswordState('saved');
      window.setTimeout(() => setPasswordState('idle'), 3000);
    } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Mot de passe impossible à modifier.'); setPasswordState('idle'); }
  };

  return (
    <main className="page-content account-page">
      <header className="page-heading account-heading"><div><span className="eyebrow">Espace personnel</span><h1>Mon compte</h1><p>Gère ton identité, la sécurité et le matériel utilisé avec Soufflet.</p></div><div className="account-identity"><span><UserRound /></span><div><strong>{user.displayName}</strong><small>Membre depuis {memberSince}</small></div></div></header>
      <div className="account-layout">
        <div className="account-main">
          <section className="account-card"><header><span><UserRound /></span><div><h2>Profil</h2><p>Ces informations identifient ton espace d’apprentissage.</p></div></header><form className="account-form" onSubmit={(event) => void saveProfile(event)}><label>Nom affiché<div className="account-field"><UserRound /><input value={displayName} minLength={2} maxLength={60} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} /></div></label><label>Adresse e-mail<div className="account-field"><Mail /><input type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></div></label>{profileError && <div className="account-message is-error"><AlertTriangle /><span>{profileError}</span></div>}{profileState === 'saved' && <div className="account-message is-success"><Check /><span>Profil mis à jour.</span></div>}<button type="submit" className="primary-button" disabled={profileState === 'saving' || !displayName.trim() || !email.trim()}>{profileState === 'saving' ? 'Enregistrement…' : profileState === 'saved' ? <><Check /> Enregistré</> : <><Save /> Enregistrer le profil</>}</button></form></section>
          <section className="account-card"><header><span><KeyRound /></span><div><h2>Mot de passe</h2><p>Après modification, les autres appareils seront automatiquement déconnectés.</p></div></header><form className="account-form" onSubmit={(event) => void changePassword(event)}><label>Mot de passe actuel<div className="account-field"><ShieldCheck /><input type={showPasswords ? 'text' : 'password'} value={currentPassword} maxLength={200} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></div></label><div className="account-form-columns"><label>Nouveau mot de passe<div className="account-field"><KeyRound /><input type={showPasswords ? 'text' : 'password'} value={newPassword} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} /></div></label><label>Confirmer<div className="account-field"><Check /><input type={showPasswords ? 'text' : 'password'} value={confirmation} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></div></label></div><button type="button" className="show-passwords" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? <EyeOff /> : <Eye />}{showPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}</button><p className="password-hint">10 caractères minimum. Évite un mot de passe déjà utilisé ailleurs.</p>{passwordError && <div className="account-message is-error"><AlertTriangle /><span>{passwordError}</span></div>}{passwordState === 'saved' && <div className="account-message is-success"><Check /><span>Mot de passe modifié. Les autres sessions sont fermées.</span></div>}<button type="submit" className="secondary-button" disabled={passwordState === 'saving' || !currentPassword || !newPassword || !confirmation}>{passwordState === 'saving' ? 'Modification…' : <><KeyRound /> Modifier le mot de passe</>}</button></form></section>
        </div>
        <aside className="account-sidebar">
          <section className="account-card equipment-card"><header><span><Music2 /></span><div><h2>Mon matériel</h2><p>Accordéon actif et configurations personnelles.</p></div></header><div className="equipment-list">{instruments.map((accordion) => <article key={accordion.id}><i style={{ background: accordion.color }} /><div><small>{accordion.maker}</small><strong>{accordion.model}</strong><span>{accordion.tuning} · {accordion.rightRows.join('+')} + {accordion.bassCount}</span></div>{accordion.id === selectedAccordionId && <em>Actif</em>}</article>)}</div><button type="button" className="account-link" onClick={onOpenSettings}><span>Gérer mes accordéons</span><ChevronRight /></button></section>
          <section className="account-card audio-profile-card"><header><span><Mic2 /></span><div><h2>Profils audio</h2><p>Microphones et latences calibrés sur tes appareils.</p></div></header><div className="empty-account-state"><Mic2 /><strong>Aucun profil enregistré</strong><p>Une calibration apparaîtra ici dès qu’elle aura été effectuée sur cet appareil.</p></div><button type="button" className="account-link" onClick={onOpenSettings}><span>Ouvrir Audio et latence</span><ChevronRight /></button></section>
          <section className="account-card session-card"><header><span><CalendarDays /></span><div><h2>Session</h2><p>La connexion expire après 30 jours.</p></div></header><button type="button" className="logout-button" onClick={onLogout}><LogOut /> Se déconnecter de cet appareil</button></section>
        </aside>
      </div>
    </main>
  );
}
