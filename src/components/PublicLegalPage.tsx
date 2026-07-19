import { AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

type LegalPageKind = 'privacy' | 'delete-account';

function Brand() {
  return <a className="legal-brand" href="/"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></a>;
}

function PrivacyPolicy() {
  return (
    <>
      <span className="eyebrow"><ShieldCheck /> Données et confidentialité</span>
      <h1>Politique de confidentialité</h1>
      <p className="legal-intro">Cette politique explique simplement quelles données Soufflet utilise, pourquoi elles sont nécessaires et comment les supprimer.</p>
      <p className="legal-date">Dernière mise à jour : 19 juillet 2026</p>
      <section><h2>Responsable du service</h2><p>Soufflet est édité par Robin Joseph. Pour toute question relative aux données, tu peux utiliser le <a href="https://github.com/robjo82/soufflet/issues" target="_blank" rel="noreferrer">canal de contact du projet</a>.</p></section>
      <section><h2>Données enregistrées</h2><ul><li>adresse e-mail, nom affiché et mot de passe conservé uniquement sous forme hachée ;</li><li>accordéons personnels, notation et préférences d’apprentissage ;</li><li>séances, durée active, résultats rythmiques et notes évaluées ;</li><li>mesures d’accordeur explicitement validées : note, fréquence, écart en cents, confiance, bouton et direction ;</li><li>cookie de session sécurisé nécessaire à la connexion, valable au maximum 30 jours.</li></ul></section>
      <section><h2>Microphone et fichiers musicaux</h2><p>Le microphone est analysé localement dans le navigateur pendant les exercices : aucun enregistrement sonore n’est envoyé ni conservé. Dans l’accordeur, seules les mesures numériques que l’utilisateur valide sont enregistrées avec son compte afin de conserver son diagnostic et de permettre son export. Lorsqu’un utilisateur demande explicitement une transcription, le fichier fourni peut être transmis temporairement au service Google Gemini pour réaliser cette analyse. Il n’est pas ajouté à la bibliothèque commune et Soufflet ne le conserve pas après le traitement.</p></section>
      <section><h2>Utilisation et partage</h2><p>Ces données servent uniquement à fournir le compte, synchroniser le matériel et mesurer la progression. Soufflet ne vend pas les données, n’affiche pas de publicité et ne les utilise pas à des fins de prospection. Google Gemini reçoit uniquement le contenu qu’un utilisateur choisit d’envoyer pour une transcription.</p></section>
      <section><h2>Sécurité et conservation</h2><p>Les échanges utilisent HTTPS, les mots de passe sont hachés et les secrets techniques restent côté serveur. Les données du compte sont conservées tant que le compte existe. Les fichiers de transcription sont éphémères.</p></section>
      <section><h2>Suppression et droits</h2><p>Le compte et ses données associées peuvent être supprimés immédiatement depuis <strong>Mon compte</strong> ou depuis la <a href="/delete-account">page publique de suppression</a>. Cette suppression concerne le profil, les sessions, les préférences et les accordéons personnels stockés sur le serveur.</p></section>
    </>
  );
}

function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState<'idle' | 'deleting' | 'deleted'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setState('deleting');
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'La suppression n’a pas pu être effectuée.');
      for (const key of Object.keys(localStorage)) if (key.startsWith('soufflet.')) localStorage.removeItem(key);
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('soufflet.')) sessionStorage.removeItem(key);
      setPassword(''); setConfirmation(''); setState('deleted');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La suppression n’a pas pu être effectuée.');
      setState('idle');
    }
  };

  if (state === 'deleted') return <div className="legal-success"><CheckCircle2 /><h1>Compte supprimé</h1><p>Le profil et toutes les données d’apprentissage associées ont été supprimés. Tu peux maintenant fermer cette page.</p><a className="primary-button" href="/">Revenir à Soufflet</a></div>;
  return (
    <>
      <span className="eyebrow"><Trash2 /> Contrôle des données</span>
      <h1>Supprimer mon compte</h1>
      <p className="legal-intro">Cette page fonctionne même après avoir désinstallé l’application. La suppression est immédiate et irréversible.</p>
      <div className="legal-delete-summary"><AlertTriangle /><p><strong>Seront supprimés :</strong> le profil, toutes les sessions, les statistiques, les préférences et les configurations personnelles d’accordéon.</p></div>
      <form className="legal-delete-form" onSubmit={(event) => void submit(event)}>
        <label>Adresse e-mail<div><Mail /><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>
        <label>Mot de passe<div><KeyRound /><input type="password" required maxLength={200} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
        <label>Écris SUPPRIMER pour confirmer<div><Trash2 /><input required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div></label>
        {error && <div className="auth-error"><AlertTriangle /><span>{error}</span></div>}
        <button type="submit" className="danger-button" disabled={state === 'deleting' || confirmation !== 'SUPPRIMER' || !email || !password}>{state === 'deleting' ? 'Suppression…' : <><Trash2 /> Supprimer définitivement</>}</button>
      </form>
      <p className="legal-footnote"><LockKeyhole /> La vérification du mot de passe empêche la suppression par une autre personne.</p>
    </>
  );
}

export function PublicLegalPage({ kind }: { kind: LegalPageKind }) {
  return (
    <main className="legal-page">
      <header><Brand /><nav><a href="/privacy">Confidentialité</a><a href="/delete-account">Suppression du compte</a></nav></header>
      <article className="legal-card">{kind === 'privacy' ? <PrivacyPolicy /> : <DeleteAccountPage />}</article>
      <footer>Soufflet · Apprentissage de l’accordéon diatonique · <a href="https://github.com/robjo82/soufflet" target="_blank" rel="noreferrer">Code source</a></footer>
    </main>
  );
}
