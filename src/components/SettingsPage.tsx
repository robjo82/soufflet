import { useState } from 'react';
import { Check, ChevronRight, Eye, EyeOff, KeyRound, Mic2, Palette, Save, ShieldCheck, Smartphone, Sparkles, TimerReset, Volume2 } from 'lucide-react';
import type { Notation, PianoInput, PianoKeyboardSize } from '../types';
import { AndroidUpdateCard } from './AndroidUpdateCard';

interface SettingsPageProps {
  notation: Notation;
  countIn: boolean;
  apiKey: string;
  pianoKeyboardSize: PianoKeyboardSize;
  pianoInput: PianoInput;
  onSave: (notation: Notation, countIn: boolean, apiKey: string, pianoKeyboardSize: PianoKeyboardSize, pianoInput: PianoInput) => void;
}

export function SettingsPage({ notation, countIn, apiKey, pianoKeyboardSize, pianoInput, onSave }: SettingsPageProps) {
  const [nextNotation, setNextNotation] = useState(notation);
  const [nextCountIn, setNextCountIn] = useState(countIn);
  const [key, setKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = () => { onSave(nextNotation, nextCountIn, key, pianoKeyboardSize, pianoInput); setSaved(true); window.setTimeout(() => setSaved(false), 1600); };

  return <main className="page-content settings-page">
    <header className="page-heading split-heading"><div><span className="eyebrow">Personnalisation</span><h1>Réglages</h1><p>Adapte l’affichage, le démarrage et l’environnement audio. Ton matériel se gère depuis le profil.</p></div><button type="button" className="primary-button" onClick={save}>{saved ? <Check /> : <Save />}{saved ? 'Enregistré' : 'Enregistrer'}</button></header>
    <div className="settings-layout"><nav className="settings-nav"><button type="button" className="is-active" onClick={() => document.getElementById('settings-notation')?.scrollIntoView({ behavior: 'smooth' })}><span><Palette /> Nom des notes</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-practice')?.scrollIntoView({ behavior: 'smooth' })}><span><TimerReset /> Démarrage des morceaux</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-audio')?.scrollIntoView({ behavior: 'smooth' })}><span><Mic2 /> Micro et latence</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-android')?.scrollIntoView({ behavior: 'smooth' })}><span><Smartphone /> Application Android</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-ai')?.scrollIntoView({ behavior: 'smooth' })}><span><Sparkles /> Transcription IA</span><ChevronRight /></button></nav>
      <div className="settings-content">
        <section className="settings-section" id="settings-notation"><div className="section-title"><div><span className="eyebrow">Convention</span><h2>Nom des notes</h2></div></div><div className="settings-options">{([['french', 'Do · Ré · Mi', 'Française'], ['english', 'C · D · E', 'Anglo-saxonne'], ['tablature', '4P · 4T · 5P', 'Tablature pousser / tirer'], ['button', '4 · 4 · 5', 'Numéros de boutons']] as Array<[Notation, string, string]>).map(([id, sample, label]) => <button type="button" key={id} className={nextNotation === id ? 'is-selected' : ''} onClick={() => setNextNotation(id)}><span>{sample}</span><strong>{label}</strong>{nextNotation === id && <Check />}</button>)}</div></section>
        <section className="settings-section" id="settings-practice"><div className="section-title"><div><span className="eyebrow">Préparation</span><h2>Démarrage des morceaux</h2></div></div><div className="preference-row"><span><TimerReset /></span><div><strong>Décompte d’une mesure</strong><p>Affiche et fait entendre le décompte avant chaque nouveau départ.</p></div><button type="button" className={`switch-control ${nextCountIn ? 'is-on' : ''}`} role="switch" aria-checked={nextCountIn} onClick={() => setNextCountIn(!nextCountIn)}><i /><b>{nextCountIn ? 'Activé' : 'Désactivé'}</b></button></div></section>
        <section className="settings-section" id="settings-audio"><div className="section-title"><div><span className="eyebrow">Microphone</span><h2>Calibration et latence</h2></div></div><div className="calibration-row"><span><Mic2 /></span><div><strong>Calibration guidée</strong><p>Le niveau et la hauteur sont testés dans le tutoriel. La mesure précise de latence est encore en validation.</p></div><em>Latence non mesurée</em><button type="button" className="secondary-button" disabled><Volume2 /> Bientôt</button></div></section>
        <section className="settings-section" id="settings-android"><div className="section-title"><div><span className="eyebrow">Téléphone et tablette</span><h2>Application Android</h2></div></div><AndroidUpdateCard /></section>
        <section className="settings-section ai-settings" id="settings-ai"><div className="section-title"><div><span className="eyebrow">Transcription assistée</span><h2>Clé Gemini</h2><p>Une clé saisie ici reste dans la session du navigateur.</p></div><span className="secure-badge"><ShieldCheck /> Connexion chiffrée requise</span></div><label className="key-field"><KeyRound /><input type={showKey ? 'text' : 'password'} value={key} onChange={(event) => setKey(event.target.value)} placeholder="AIza…" autoComplete="off" /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff /> : <Eye />}</button></label></section>
      </div>
    </div>
  </main>;
}
