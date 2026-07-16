import { useState } from 'react';
import { AlertTriangle, ArrowRight, Eye, EyeOff, LockKeyhole, Mic2, Music2, ShieldCheck, UserRound } from 'lucide-react';
import type { UserAccount } from '../types';

interface AuthPageProps {
  onAuthenticated: (user: UserAccount) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mode === 'register' ? { displayName } : {}) }),
      });
      const payload = await response.json() as { user?: UserAccount; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? 'Impossible de continuer.');
      onAuthenticated(payload.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de continuer.');
    } finally { setSubmitting(false); }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong></span>
        <div><span className="eyebrow">Ton professeur d’accordéon</span><h1>Commence par une note.<br /><em>On construit la suite ensemble.</em></h1><p>Une progression calme, un retour précis du microphone et un accordéon qui ressemble au tien.</p></div>
        <ul><li><Music2 /><span><strong>Un premier morceau en quelques minutes</strong>Sans connaître le solfège.</span></li><li><Mic2 /><span><strong>La machine t’écoute vraiment</strong>Elle indique la note entendue et comment corriger.</span></li><li><ShieldCheck /><span><strong>Ta progression reste privée</strong>Mot de passe chiffré et microphone analysé dans le navigateur.</span></li></ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-icon"><UserRound /></span>
          <span className="eyebrow">{mode === 'register' ? 'Première visite' : 'Bon retour'}</span>
          <h2>{mode === 'register' ? 'Crée ton espace' : 'Reprends ta progression'}</h2>
          <p>{mode === 'register' ? 'Trois informations, puis nous configurons ton instrument ensemble.' : 'Connecte-toi pour retrouver ta bibliothèque et ton accordéon.'}</p>
          <form onSubmit={(event) => void submit(event)}>
            {mode === 'register' && <label>Comment doit-on t’appeler ?<input autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={60} required placeholder="Robin" autoComplete="name" /></label>}
            <label>Adresse e-mail<input autoFocus={mode === 'login'} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="toi@exemple.fr" autoComplete="email" /></label>
            <label>Mot de passe<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={200} required placeholder="10 caractères minimum" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
            {error && <div className="auth-error"><AlertTriangle /> {error}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={submitting}>{submitting ? 'Un instant…' : mode === 'register' ? 'Créer mon espace' : 'Me connecter'} <ArrowRight /></button>
          </form>
          <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'J’ai déjà un compte' : 'Je découvre Soufflet'}</button>
          <small className="auth-privacy"><LockKeyhole /><span>Aucun son du micro n’est envoyé ni conservé pendant les exercices. <a href="/privacy">Confidentialité</a> · <a href="/delete-account">Supprimer un compte</a></span></small>
        </div>
      </section>
    </main>
  );
}
