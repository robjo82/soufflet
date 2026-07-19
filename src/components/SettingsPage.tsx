import { useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Copy, Eye, EyeOff, KeyRound, Mic2, Palette, Save, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, TimerReset, Volume2, X } from 'lucide-react';
import type { AccordionConfig, Notation } from '../types';
import { AccordionInstrument } from './AccordionInstrument';
import { AndroidUpdateCard } from './AndroidUpdateCard';

interface SettingsPageProps {
  accordions: AccordionConfig[];
  selectedId: string;
  notation: Notation;
  countIn: boolean;
  apiKey: string;
  onSave: (accordionId: string, notation: Notation, countIn: boolean, apiKey: string) => void;
  onCreateAccordion: (accordion: AccordionConfig) => Promise<AccordionConfig>;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const NOTE_OPTIONS = Array.from({ length: 61 }, (_, index) => {
  const midi = index + 36;
  return { midi, label: noteName(midi) };
});

export function SettingsPage({ accordions, selectedId, notation, countIn, apiKey, onSave, onCreateAccordion }: SettingsPageProps) {
  const [selected, setSelected] = useState(selectedId);
  const [nextNotation, setNextNotation] = useState(notation);
  const [nextCountIn, setNextCountIn] = useState(countIn);
  const [key, setKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const accordion = accordions.find((item) => item.id === selected) ?? accordions[0];
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<AccordionConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const openCustomEditor = () => {
    setCreateError('');
    setDraft({ ...structuredClone(accordion), id: 'draft', maker: accordion.maker, model: `${accordion.model} personnalisé`, verified: false, sourceNote: 'Configuration personnalisée à vérifier avec l’accordeur.' });
  };

  const createAccordion = async () => {
    if (!draft) return;
    setCreating(true); setCreateError('');
    try {
      const created = await onCreateAccordion(draft);
      setSelected(created.id); setDraft(null); setSaved(true); setTimeout(() => setSaved(false), 1600);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Impossible d’enregistrer cette configuration.');
    } finally { setCreating(false); }
  };
  return (
    <main className="page-content settings-page">
      <header className="page-heading split-heading"><div><span className="eyebrow">Personnalisation</span><h1>Réglages</h1><p>Ton instrument, tes repères, ton environnement de pratique.</p></div><button type="button" className="primary-button" onClick={() => { onSave(selected, nextNotation, nextCountIn, key); setSaved(true); setTimeout(() => setSaved(false), 1600); }}>{saved ? <Check /> : <Save />} {saved ? 'Enregistré' : 'Enregistrer'}</button></header>
      <div className="settings-layout"><nav className="settings-nav"><button type="button" className="is-active" onClick={() => document.getElementById('settings-instrument')?.scrollIntoView({ behavior: 'smooth' })}><span><SlidersHorizontal /> Instrument</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-notation')?.scrollIntoView({ behavior: 'smooth' })}><span><Palette /> Affichage</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-practice')?.scrollIntoView({ behavior: 'smooth' })}><span><TimerReset /> Séances</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-android')?.scrollIntoView({ behavior: 'smooth' })}><span><Smartphone /> Android</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-audio')?.scrollIntoView({ behavior: 'smooth' })}><span><Mic2 /> Audio et latence</span><ChevronRight /></button><button type="button" onClick={() => document.getElementById('settings-ai')?.scrollIntoView({ behavior: 'smooth' })}><span><Sparkles /> Intelligence artificielle</span><ChevronRight /></button></nav>
      <div className="settings-content">
        <section className="settings-section" id="settings-instrument"><div className="section-title"><div><span className="eyebrow">Instrument actif</span><h2>Ton accordéon</h2></div></div><div className="accordion-setting-grid"><div className="accordion-list">{accordions.map((item) => <button type="button" key={item.id} className={item.id === selected ? 'is-selected' : ''} onClick={() => setSelected(item.id)}><span style={{ background: item.color }} /><span><small>{item.maker}</small><strong>{item.model}</strong><em>{item.tuning}</em></span>{item.id === selected && <Check />}</button>)}<button type="button" className="custom-instrument" onClick={openCustomEditor}><span>+</span><strong>Créer une configuration personnalisée</strong></button></div><div className="instrument-preview"><AccordionInstrument config={accordion} direction="push" notation={nextNotation} compact context="settings" showLearningGuides={false} /><p>{accordion.description}</p>{!accordion.verified && <div className="warning-inline"><AlertTriangle /> Cette disposition varie selon l’année. Vérifie-la bouton par bouton avec l’accordeur.</div>}</div></div></section>
        <section className="settings-section" id="settings-notation"><div className="section-title"><div><span className="eyebrow">Convention</span><h2>Nom des notes</h2></div></div><div className="settings-options">{([['french', 'Do · Ré · Mi', 'Française'], ['english', 'C · D · E', 'Anglo-saxonne'], ['tablature', '4P · 4T · 5P', 'Tablature pousser / tirer'], ['button', '4 · 4 · 5', 'Numéros de boutons']] as Array<[Notation, string, string]>).map(([id, sample, label]) => <button type="button" key={id} className={nextNotation === id ? 'is-selected' : ''} onClick={() => setNextNotation(id)}><span>{sample}</span><strong>{label}</strong>{nextNotation === id && <Check />}</button>)}</div></section>
        <section className="settings-section" id="settings-practice"><div className="section-title"><div><span className="eyebrow">Préparation</span><h2>Démarrage des morceaux</h2></div></div><div className="preference-row"><span><TimerReset /></span><div><strong>Décompte d’une mesure</strong><p>Affiche et fait entendre 4–3–2–1, ou le nombre de temps de la mesure, avant chaque nouveau départ.</p></div><button type="button" className={`switch-control ${nextCountIn ? 'is-on' : ''}`} role="switch" aria-checked={nextCountIn} onClick={() => setNextCountIn(!nextCountIn)}><i /><b>{nextCountIn ? 'Activé' : 'Désactivé'}</b></button></div></section>
        <section className="settings-section" id="settings-android"><div className="section-title"><div><span className="eyebrow">Téléphone et tablette</span><h2>Application Android</h2><p>La même bibliothèque, le même matériel et la même progression sur le web et sur Android.</p></div></div><AndroidUpdateCard /></section>
        <section className="settings-section ai-settings" id="settings-ai"><div className="section-title"><div><span className="eyebrow">Transcription assistée</span><h2>Clé Gemini</h2><p>Si aucune clé personnelle n’est fournie, le serveur utilise <code>GEMINI_API_KEY</code>. Une clé saisie ici reste dans la session de ce navigateur et n’est jamais enregistrée en base.</p></div><span className="secure-badge"><ShieldCheck /> Connexion chiffrée requise en production</span></div><label className="key-field"><KeyRound /><input type={showKey ? 'text' : 'password'} value={key} onChange={(event) => setKey(event.target.value)} placeholder="AIza… (facultatif si configurée sur le serveur)" autoComplete="off" /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff /> : <Eye />}</button></label><div className="key-help"><Sparkles /><span><strong>Modèle par défaut : Gemini 3.5 Flash</strong>Audio, vidéo, PDF, images et sorties structurées. Chaque résultat conserve son score de confiance.</span></div></section>
        <section className="settings-section" id="settings-audio"><div className="section-title"><div><span className="eyebrow">Son et microphone</span><h2>Instrument, calibration et latence</h2></div></div><div className="calibration-row"><span><Volume2 /></span><div><strong>Timbre Hohner enregistré</strong><p>Les démonstrations utilisent 17 notes d’un véritable accordéon, transposées et bouclées localement. Les basses et accords emploient la même banque acoustique.</p></div><em>FreePats · CC0</em></div><div className="calibration-row"><span><Mic2 /></span><div><strong>Calibration guidée</strong><p>Le niveau et la hauteur sont testés dans l’onboarding. La mesure aller-retour exacte est encore en validation multi-appareils.</p></div><em>Latence non mesurée</em><button type="button" className="secondary-button" disabled title="Fonction en cours de validation"><Volume2 /> Bientôt en bêta</button></div></section>
      </div></div>
      {draft && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}><div className="accordion-editor" role="dialog" aria-modal="true" aria-labelledby="accordion-editor-title"><header><div><span className="eyebrow"><Copy /> Copie de {accordion.model}</span><h2 id="accordion-editor-title">Configurer chaque bouton</h2><p>Pars d’un modèle proche du tien, puis vérifie les notes avec l’accordeur.</p></div><button type="button" className="icon-button" onClick={() => setDraft(null)}><X /></button></header><div className="editor-fields"><label>Fabricant<input value={draft.maker} onChange={(event) => setDraft({ ...draft, maker: event.target.value })} /></label><label>Modèle<input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label><label>Accordage<input value={draft.tuning} onChange={(event) => setDraft({ ...draft, tuning: event.target.value })} /></label><label>Couleur<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label></div><div className="button-map-editor"><div className="button-map-head"><span>Bouton</span><span>Pousser →</span><span>← Tirer</span><span>Doigt</span></div>{draft.buttons.map((button, index) => <div className="button-map-row" key={button.id}><strong>R{button.row} · {button.index}{button.isGleichton && <small> Gleichton</small>}</strong><select value={button.pushMidi} onChange={(event) => { const midi = Number(event.target.value); setDraft({ ...draft, buttons: draft.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, pushMidi: midi, push: noteName(midi) } : item) }); }}>{NOTE_OPTIONS.map((note) => <option value={note.midi} key={note.midi}>{note.label}</option>)}</select><select value={button.pullMidi} onChange={(event) => { const midi = Number(event.target.value); setDraft({ ...draft, buttons: draft.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, pullMidi: midi, pull: noteName(midi) } : item) }); }}>{NOTE_OPTIONS.map((note) => <option value={note.midi} key={note.midi}>{note.label}</option>)}</select><select value={button.finger ?? 2} onChange={(event) => setDraft({ ...draft, buttons: draft.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, finger: Number(event.target.value) } : item) })}>{[2, 3, 4, 5].map((finger) => <option value={finger} key={finger}>{finger}</option>)}</select></div>)}</div>{createError && <div className="error-banner"><AlertTriangle /><span><strong>Enregistrement impossible</strong>{createError}</span></div>}<footer><div className="warning-inline"><AlertTriangle /> Une mauvaise cartographie rendra les conseils faux. Vérifie les deux directions de chaque bouton.</div><button type="button" className="primary-button" disabled={creating || !draft.maker.trim() || !draft.model.trim()} onClick={() => void createAccordion()}>{creating ? 'Enregistrement…' : 'Créer cet accordéon'} <Save /></button></footer></div></div>}
    </main>
  );
}
