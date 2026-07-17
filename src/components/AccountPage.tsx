import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Mail, Mic2, MoveHorizontal, Music2, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import type { AccordionConfig, InstrumentType, PianoConfig, UserAccount } from '../types';
import { readBellowsProfiles } from '../audioTraining';
import { ProfileInstrumentManager } from './ProfileInstrumentManager';

interface AccountPageProps {
  user: UserAccount;
  accordions: AccordionConfig[];
  pianos: PianoConfig[];
  selectedAccordionId: string;
  instrumentType: InstrumentType;
  learningInstruments: InstrumentType[];
  onInstrumentChange: (instrument: InstrumentType) => void;
  onLearningInstrumentsChange: (instruments: InstrumentType[], active: InstrumentType) => void;
  onUserUpdated: (user: UserAccount) => void;
  onAccountDeleted: () => void;
  onSaveAccordion: (accordion: AccordionConfig) => Promise<AccordionConfig>;
  onDeleteAccordion: (id: string) => Promise<void>;
  onSavePiano: (piano: PianoConfig) => Promise<PianoConfig>;
  onDeletePiano: (id: string) => Promise<void>;
}

async function readResponse<T>(response: Response) {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Une erreur est survenue.');
  return payload;
}

export function AccountPage({ user, accordions, pianos, selectedAccordionId, instrumentType, learningInstruments, onInstrumentChange, onLearningInstrumentsChange, onUserUpdated, onAccountDeleted, onSaveAccordion, onDeleteAccordion, onSavePiano, onDeletePiano }: AccountPageProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [avatarId, setAvatarId] = useState(user.avatarId ?? 'neutral');
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordState, setPasswordState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [passwordError, setPasswordError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const audioProfiles = useMemo(() => Object.values(readBellowsProfiles()), []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setProfileState('saving'); setProfileError('');
    try {
      const payload = await readResponse<{ user: UserAccount }>(await fetch('/api/account/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, email, avatarId }),
      }));
      onUserUpdated(payload.user); setDisplayName(payload.user.displayName); setEmail(payload.user.email); setAvatarId(payload.user.avatarId ?? 'neutral'); setProfileState('saved');
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

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setDeleteError(''); setDeleteState('deleting');
    try {
      await readResponse<{ message: string }>(await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword }),
      }));
      onAccountDeleted();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Le compte n’a pas pu être supprimé.');
      setDeleteState('idle');
    }
  };

  return (
    <main className={`page-content account-page ${learningInstruments.includes('accordion') ? '' : 'piano-only-profile'}`}>
      <header className="page-heading account-heading"><div><span className="eyebrow">Espace personnel</span><h1>Mon profil</h1><p>Gère ton identité, la sécurité et le matériel utilisé avec Soufflet.</p></div></header>
      <div className="account-layout">
        <div className="account-main">
          <section className="account-card"><header><span><UserRound /></span><div><h2>Profil</h2><p>Ces informations identifient ton espace d’apprentissage.</p></div></header><form className="account-form" onSubmit={(event) => void saveProfile(event)}><label>Nom affiché<div className="account-field"><UserRound /><input value={displayName} minLength={2} maxLength={60} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} /></div></label><label>Adresse e-mail<div className="account-field"><Mail /><input type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></div></label>{profileError && <div className="account-message is-error"><AlertTriangle /><span>{profileError}</span></div>}{profileState === 'saved' && <div className="account-message is-success"><Check /><span>Profil mis à jour.</span></div>}<button type="submit" className="primary-button" disabled={profileState === 'saving' || !displayName.trim() || !email.trim()}>{profileState === 'saving' ? 'Enregistrement…' : profileState === 'saved' ? <><Check /> Enregistré</> : <><Save /> Enregistrer le profil</>}</button></form></section>
          <section className="account-card"><header><span><KeyRound /></span><div><h2>Mot de passe</h2><p>Après modification, les autres appareils seront automatiquement déconnectés.</p></div></header><form className="account-form" onSubmit={(event) => void changePassword(event)}><label>Mot de passe actuel<div className="account-field"><ShieldCheck /><input type={showPasswords ? 'text' : 'password'} value={currentPassword} maxLength={200} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></div></label><div className="account-form-columns"><label>Nouveau mot de passe<div className="account-field"><KeyRound /><input type={showPasswords ? 'text' : 'password'} value={newPassword} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} /></div></label><label>Confirmer<div className="account-field"><Check /><input type={showPasswords ? 'text' : 'password'} value={confirmation} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></div></label></div><button type="button" className="show-passwords" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? <EyeOff /> : <Eye />}{showPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}</button><p className="password-hint">10 caractères minimum. Évite un mot de passe déjà utilisé ailleurs.</p>{passwordError && <div className="account-message is-error"><AlertTriangle /><span>{passwordError}</span></div>}{passwordState === 'saved' && <div className="account-message is-success"><Check /><span>Mot de passe modifié. Les autres sessions sont fermées.</span></div>}<button type="submit" className="secondary-button" disabled={passwordState === 'saving' || !currentPassword || !newPassword || !confirmation}>{passwordState === 'saving' ? 'Modification…' : <><KeyRound /> Modifier le mot de passe</>}</button></form></section>
          <section className="account-card danger-zone"><header><span><Trash2 /></span><div><h2>Supprimer mon compte</h2><p>Supprime définitivement le profil, les réglages personnels et tout l’historique d’apprentissage.</p></div></header>{!deleteOpen ? <button type="button" className="danger-button" onClick={() => setDeleteOpen(true)}><Trash2 /> Commencer la suppression</button> : <form className="account-form" onSubmit={(event) => void deleteAccount(event)}><div className="danger-warning"><AlertTriangle /><p><strong>Cette action est irréversible.</strong> Les données du serveur et les données Soufflet de cet appareil seront supprimées.</p></div><label>Mot de passe actuel<div className="account-field"><KeyRound /><input type="password" value={deletePassword} maxLength={200} autoComplete="current-password" onChange={(event) => setDeletePassword(event.target.value)} /></div></label><label>Écris SUPPRIMER pour confirmer<div className="account-field"><Trash2 /><input value={deleteConfirmation} autoComplete="off" onChange={(event) => setDeleteConfirmation(event.target.value)} /></div></label>{deleteError && <div className="account-message is-error"><AlertTriangle /><span>{deleteError}</span></div>}<div className="danger-actions"><button type="button" className="secondary-button" disabled={deleteState === 'deleting'} onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteConfirmation(''); setDeleteError(''); }}>Annuler</button><button type="submit" className="danger-button" disabled={deleteState === 'deleting' || !deletePassword || deleteConfirmation !== 'SUPPRIMER'}>{deleteState === 'deleting' ? 'Suppression…' : <><Trash2 /> Supprimer définitivement</>}</button></div></form>}</section>
        </div>
        <aside className="account-sidebar">
          <section className="account-card"><header><span><UserRound /></span><div><h2>Photo de profil</h2><p>Choisis la représentation qui te ressemble.</p></div></header><div className="avatar-picker">{['man-1', 'man-2', 'woman-1', 'woman-2', 'neutral'].map((avatar) => <button type="button" key={avatar} className={avatarId === avatar ? 'is-selected' : ''} onClick={() => setAvatarId(avatar)} aria-label={`Choisir l’avatar ${avatar}`}><img src={`/avatars/${avatar}.svg`} alt="" />{avatarId === avatar && <Check />}</button>)}</div><small>L’avatar est enregistré avec le bouton « Enregistrer le profil ».</small></section>
          <section className="account-card"><header><span><Music2 /></span><div><h2>Mes parcours</h2><p>Sélectionne les apprentissages à afficher.</p></div></header><div className="profile-instrument"><button type="button" className={learningInstruments.includes('accordion') ? 'is-selected' : ''} onClick={() => { const enabled = learningInstruments.includes('accordion'); if (enabled && learningInstruments.length === 1) return; const next = enabled ? learningInstruments.filter((item) => item !== 'accordion') : [...learningInstruments, 'accordion' as const]; onLearningInstrumentsChange(next, instrumentType === 'accordion' && enabled ? next[0] : instrumentType); }}>Accordéon {learningInstruments.includes('accordion') && '✓'}</button><button type="button" className={learningInstruments.includes('piano') ? 'is-selected' : ''} onClick={() => { const enabled = learningInstruments.includes('piano'); if (enabled && learningInstruments.length === 1) return; const next = enabled ? learningInstruments.filter((item) => item !== 'piano') : [...learningInstruments, 'piano' as const]; onLearningInstrumentsChange(next, instrumentType === 'piano' && enabled ? next[0] : instrumentType); }}>Piano {learningInstruments.includes('piano') && '✓'}</button></div>{learningInstruments.length === 2 && <div className="active-path"><span>Parcours affiché</span><button type="button" onClick={() => onInstrumentChange(instrumentType === 'accordion' ? 'piano' : 'accordion')}>{instrumentType === 'accordion' ? 'Accordéon' : 'Piano'}</button></div>}</section>
          <ProfileInstrumentManager accordions={accordions} pianos={pianos} selectedAccordionId={selectedAccordionId} onSaveAccordion={onSaveAccordion} onDeleteAccordion={onDeleteAccordion} onSavePiano={onSavePiano} onDeletePiano={onDeletePiano} />
          <section className="account-card audio-profile-card"><header><span><Mic2 /></span><div><h2>Profils audio</h2><p>Calibrations acoustiques conservées sur cet appareil.</p></div></header>{audioProfiles.length ? <div className="audio-profile-list">{audioProfiles.map((profile) => { const instrument = accordions.find((accordion) => accordion.id === profile.accordionId); return <article key={profile.accordionId}><span><MoveHorizontal /></span><div><strong>Soufflet pousser / tirer</strong><small>{instrument?.model ?? 'Accordéon personnalisé'} · bouton {instrument?.buttons.find((button) => button.id === profile.buttonId)?.index ?? '—'}</small></div><em>Calibré</em></article>; })}</div> : <div className="empty-account-state"><Mic2 /><strong>Aucun profil enregistré</strong><p>La calibration du mode soufflet apparaîtra ici après ton premier essai au micro.</p></div>}</section>
        </aside>
      </div>
    </main>
  );
}
