import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronRight, Eye, EyeOff, Guitar, KeyRound, LogOut, Mail, Mic2, MoveHorizontal, Music2, Piano, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import type { AccordionConfig, GuitarConfig, InstrumentType, LeftHandAcousticProfile, PianoConfig, UserAccount } from '../types';
import { readBellowsProfiles } from '../audioTraining';

interface AccountPageProps {
  user: UserAccount;
  accordions: AccordionConfig[];
  selectedAccordionId: string;
  pianos?: PianoConfig[];
  selectedPianoId?: string;
  guitars?: GuitarConfig[];
  selectedGuitarId?: string;
  instrumentType: InstrumentType;
  onUserUpdated: (user: UserAccount) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
}

async function readResponse<T>(response: Response) {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Une erreur est survenue.');
  return payload;
}

export function AccountPage({ user, accordions, selectedAccordionId, pianos = [], selectedPianoId, guitars = [], selectedGuitarId, instrumentType, onUserUpdated, onOpenSettings, onLogout, onAccountDeleted }: AccountPageProps) {
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const instruments = useMemo(() => {
    const selected = accordions.find((accordion) => accordion.id === selectedAccordionId);
    const personal = accordions.filter((accordion) => accordion.id.startsWith('custom-'));
    return [selected, ...personal].filter((accordion, index, items): accordion is AccordionConfig => Boolean(accordion) && items.findIndex((item) => item?.id === accordion?.id) === index);
  }, [accordions, selectedAccordionId]);
  const bellowsProfiles = useMemo(() => Object.values(readBellowsProfiles()), []);
  const [leftHandProfiles, setLeftHandProfiles] = useState<LeftHandAcousticProfile[]>([]);
  const activePiano = pianos.find((piano) => piano.id === selectedPianoId);
  const activeGuitar = guitars.find((guitar) => guitar.id === selectedGuitarId);
  const accountDate = user.createdAt.includes('T') ? user.createdAt : `${user.createdAt.replace(' ', 'T')}Z`;
  const memberSince = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(accountDate));

  useEffect(() => {
    let active = true;
    void fetch('/api/audio-profiles/left-hand')
      .then((response) => response.ok ? response.json() as Promise<{ profiles: LeftHandAcousticProfile[] }> : Promise.reject())
      .then((payload) => { if (active) setLeftHandProfiles(payload.profiles); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

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
    <main className="page-content account-page">
      <header className="page-heading account-heading"><div><span className="eyebrow">Espace personnel</span><h1>Mon compte</h1><p>Gère ton identité, la sécurité et le matériel utilisé avec Soufflet.</p></div><div className="account-identity"><span><UserRound /></span><div><strong>{user.displayName}</strong><small>Membre depuis {memberSince}</small></div></div></header>
      <div className="account-layout">
        <div className="account-main">
          <section className="account-card"><header><span><UserRound /></span><div><h2>Profil</h2><p>Ces informations identifient ton espace d’apprentissage.</p></div></header><form className="account-form" onSubmit={(event) => void saveProfile(event)}><label>Nom affiché<div className="account-field"><UserRound /><input value={displayName} minLength={2} maxLength={60} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} /></div></label><label>Adresse e-mail<div className="account-field"><Mail /><input type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></div></label>{profileError && <div className="account-message is-error"><AlertTriangle /><span>{profileError}</span></div>}{profileState === 'saved' && <div className="account-message is-success"><Check /><span>Profil mis à jour.</span></div>}<button type="submit" className="primary-button" disabled={profileState === 'saving' || !displayName.trim() || !email.trim()}>{profileState === 'saving' ? 'Enregistrement…' : profileState === 'saved' ? <><Check /> Enregistré</> : <><Save /> Enregistrer le profil</>}</button></form></section>
          <section className="account-card"><header><span><KeyRound /></span><div><h2>Mot de passe</h2><p>Après modification, les autres appareils seront automatiquement déconnectés.</p></div></header><form className="account-form" onSubmit={(event) => void changePassword(event)}><label>Mot de passe actuel<div className="account-field"><ShieldCheck /><input type={showPasswords ? 'text' : 'password'} value={currentPassword} maxLength={200} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></div></label><div className="account-form-columns"><label>Nouveau mot de passe<div className="account-field"><KeyRound /><input type={showPasswords ? 'text' : 'password'} value={newPassword} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} /></div></label><label>Confirmer<div className="account-field"><Check /><input type={showPasswords ? 'text' : 'password'} value={confirmation} minLength={10} maxLength={200} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></div></label></div><button type="button" className="show-passwords" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? <EyeOff /> : <Eye />}{showPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}</button><p className="password-hint">10 caractères minimum. Évite un mot de passe déjà utilisé ailleurs.</p>{passwordError && <div className="account-message is-error"><AlertTriangle /><span>{passwordError}</span></div>}{passwordState === 'saved' && <div className="account-message is-success"><Check /><span>Mot de passe modifié. Les autres sessions sont fermées.</span></div>}<button type="submit" className="secondary-button" disabled={passwordState === 'saving' || !currentPassword || !newPassword || !confirmation}>{passwordState === 'saving' ? 'Modification…' : <><KeyRound /> Modifier le mot de passe</>}</button></form></section>
          <section className="account-card danger-zone"><header><span><Trash2 /></span><div><h2>Supprimer mon compte</h2><p>Supprime définitivement le profil, les réglages personnels et tout l’historique d’apprentissage.</p></div></header>{!deleteOpen ? <button type="button" className="danger-button" onClick={() => setDeleteOpen(true)}><Trash2 /> Commencer la suppression</button> : <form className="account-form" onSubmit={(event) => void deleteAccount(event)}><div className="danger-warning"><AlertTriangle /><p><strong>Cette action est irréversible.</strong> Les données du serveur et les données Soufflet de cet appareil seront supprimées.</p></div><label>Mot de passe actuel<div className="account-field"><KeyRound /><input type="password" value={deletePassword} maxLength={200} autoComplete="current-password" onChange={(event) => setDeletePassword(event.target.value)} /></div></label><label>Écris SUPPRIMER pour confirmer<div className="account-field"><Trash2 /><input value={deleteConfirmation} autoComplete="off" onChange={(event) => setDeleteConfirmation(event.target.value)} /></div></label>{deleteError && <div className="account-message is-error"><AlertTriangle /><span>{deleteError}</span></div>}<div className="danger-actions"><button type="button" className="secondary-button" disabled={deleteState === 'deleting'} onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteConfirmation(''); setDeleteError(''); }}>Annuler</button><button type="submit" className="danger-button" disabled={deleteState === 'deleting' || !deletePassword || deleteConfirmation !== 'SUPPRIMER'}>{deleteState === 'deleting' ? 'Suppression…' : <><Trash2 /> Supprimer définitivement</>}</button></div></form>}</section>
        </div>
        <aside className="account-sidebar">
          <section className="account-card equipment-card"><header><span><Music2 /></span><div><h2>Mon matériel</h2><p>L’instrument actif et sa configuration sont synchronisés avec ton compte.</p></div></header><div className="equipment-list">{instrumentType === 'accordion' && instruments.map((accordion) => <article key={accordion.id}><i style={{ background: accordion.color }} /><div><small>{accordion.maker}</small><strong>{accordion.model}</strong><span>{accordion.tuning} · {accordion.rightRows.join('+')} + {accordion.bassCount}</span></div>{accordion.id === selectedAccordionId && <em>Accordéon actif</em>}</article>)}{instrumentType === 'piano' && activePiano && <article><i className="piano-equipment-mark" /><div><small>Piano · {activePiano.keyboardSize} touches</small><strong>{activePiano.name}</strong><span>{activePiano.input === 'midi' ? 'Entrée MIDI' : activePiano.input === 'microphone' ? 'Écoute au microphone' : 'Clavier d’ordinateur'}</span></div><em>Piano actif</em></article>}{instrumentType === 'guitar' && activeGuitar && <article><i className="guitar-equipment-mark" /><div><small>Guitare · {activeGuitar.strings.length} cordes</small><strong>{activeGuitar.name}</strong><span>{activeGuitar.strings.map((string) => string.note).join(' · ')}{activeGuitar.capo ? ` · capo ${activeGuitar.capo}` : ''}</span></div><em>Guitare active</em></article>}</div><button type="button" className="account-link" onClick={onOpenSettings}><span>Gérer mes instruments</span><ChevronRight /></button></section>
          {instrumentType === 'accordion' ? <section className="account-card audio-profile-card"><header><span><Mic2 /></span><div><h2>Profils audio de l’accordéon</h2><p>Les scans sont synchronisés ; la signature du soufflet reste locale à chaque micro.</p></div></header>{leftHandProfiles.length || bellowsProfiles.length ? <div className="audio-profile-list">{leftHandProfiles.map((profile) => { const instrument = accordions.find((accordion) => accordion.id === profile.accordionId); const matched = profile.samples.filter((sample) => sample.outcome === 'matched').length; return <article key={`left-${profile.accordionId}`}><span><Mic2 /></span><div><strong>Main gauche · {profile.samples.length} geste{profile.samples.length > 1 ? 's' : ''}</strong><small>{instrument?.model ?? profile.accordionModel} · {matched} reconnu{matched > 1 ? 's' : ''} · A = {profile.referencePitchHz} Hz</small></div><em>Synchronisé</em></article>; })}{bellowsProfiles.map((profile) => { const instrument = accordions.find((accordion) => accordion.id === profile.accordionId); return <article key={`bellows-${profile.accordionId}`}><span><MoveHorizontal /></span><div><strong>Soufflet pousser / tirer</strong><small>{instrument?.model ?? 'Accordéon personnalisé'} · bouton {instrument?.buttons.find((button) => button.id === profile.buttonId)?.index ?? '—'} · cet appareil</small></div><em>Local</em></article>; })}</div> : <div className="empty-account-state"><Mic2 /><strong>Aucun profil enregistré</strong><p>Le scan main gauche et la calibration du soufflet apparaîtront ici après leur premier essai au micro.</p></div>}<button type="button" className="account-link" onClick={onOpenSettings}><span>Ouvrir Audio et latence</span><ChevronRight /></button></section> : <section className="account-card audio-profile-card"><header><span>{instrumentType === 'piano' ? <Piano /> : <Guitar />}</span><div><h2>{instrumentType === 'piano' ? 'Entrée du piano' : 'Écoute de la guitare'}</h2><p>{instrumentType === 'piano' ? 'La configuration MIDI ou microphone suit ton compte sur tous tes appareils.' : 'Le microphone chromatique utilise l’accordage de ta guitare active.'}</p></div></header><div className="audio-profile-list"><article><span>{instrumentType === 'piano' && activePiano?.input === 'midi' ? <Piano /> : <Mic2 />}</span><div><strong>{instrumentType === 'piano' ? activePiano?.input === 'midi' ? 'MIDI polyphonique' : 'Microphone monophonique' : 'Détection des notes et accords'}</strong><small>{instrumentType === 'piano' ? activePiano?.name : activeGuitar?.name}</small></div><em>Synchronisé</em></article></div><button type="button" className="account-link" onClick={onOpenSettings}><span>Ouvrir Audio et latence</span><ChevronRight /></button></section>}
          <section className="account-card session-card"><header><span><CalendarDays /></span><div><h2>Session</h2><p>La connexion expire après 30 jours.</p></div></header><button type="button" className="logout-button" onClick={onLogout}><LogOut /> Se déconnecter de cet appareil</button><div className="account-legal-links"><a href="/privacy">Politique de confidentialité</a><a href="/delete-account">Suppression du compte</a></div></section>
        </aside>
      </div>
    </main>
  );
}
