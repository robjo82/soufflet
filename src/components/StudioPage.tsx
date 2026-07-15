import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock3, Cloud, History, Music2, Play, Redo2, Save, Scissors, Sparkles, Undo2, WandSparkles } from 'lucide-react';
import type { AccordionConfig, Song, SongEvent } from '../types';
import { AccordionView } from './AccordionView';

interface StudioPageProps {
  songs: Song[];
  initialSong?: Song;
  accordion: AccordionConfig;
  onSave: (song: Song) => void;
  onPractice: (song: Song) => void;
}

export function StudioPage({ songs, initialSong, accordion, onSave, onPractice }: StudioPageProps) {
  const editableSongs = songs.filter((song) => song.events.length > 0);
  const [song, setSong] = useState<Song>(initialSong ?? editableSongs[0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saved, setSaved] = useState(true);
  const [history, setHistory] = useState<Song[]>([]);
  const active = song?.events[activeIndex];

  useEffect(() => { if (initialSong) { setSong(initialSong); setActiveIndex(0); } }, [initialSong]);
  useEffect(() => {
    if (!song || saved) return;
    const timer = window.setTimeout(() => { onSave(song); setSaved(true); }, 1200);
    return () => clearTimeout(timer);
  }, [onSave, saved, song]);

  if (!song) return <main className="page-content empty-studio"><WandSparkles /><h1>Le studio est prêt</h1><p>Importe un morceau pour corriger les notes, le rythme, les doigtés et le soufflet.</p></main>;

  const updateEvent = (patch: Partial<SongEvent>) => {
    setHistory((items) => [...items.slice(-19), song]);
    setSong({ ...song, events: song.events.map((event, index) => index === activeIndex ? { ...event, ...patch } : event), status: 'needs-review' });
    setSaved(false);
  };
  const undo = () => {
    const previous = history.at(-1); if (!previous) return;
    setSong(previous); setHistory((items) => items.slice(0, -1)); setSaved(false);
  };

  return (
    <main className="studio-page">
      <header className="studio-header"><div><span className="eyebrow"><Sparkles /> Éditeur de tablature</span><h1>Studio</h1></div><label className="song-select"><Music2 /><span><small>MORCEAU OUVERT</small><select value={song.id} onChange={(event) => { const next = editableSongs.find((item) => item.id === event.target.value); if (next) { setSong(next); setActiveIndex(0); } }}>{editableSongs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></span><ChevronDown /></label><div className="studio-actions"><button type="button" className="icon-button" onClick={undo} disabled={!history.length} title="Annuler"><Undo2 /></button><button type="button" className="icon-button" disabled title="Rétablir"><Redo2 /></button><span className="save-state">{saved ? <><Cloud /> Sauvegardé localement</> : <><Save /> Sauvegarde…</>}</span><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> Tester</button></div></header>

      <div className="studio-toolbar"><button type="button" className="is-active"><Music2 /> Note</button><button type="button"><Scissors /> Découper</button><button type="button"><Clock3 /> Durée</button><span /><button type="button"><History /> Historique</button><span className="confidence-legend"><i /> Incertain · vérification nécessaire</span></div>

      <section className="studio-timeline">
        <div className="timeline-ruler">{Array.from({ length: Math.ceil((song.events.at(-1)?.beat ?? 0) / 4) + 1 }).map((_, index) => <span key={index}>Mesure {index + 1}</span>)}</div>
        <div className="timeline-track">{song.events.map((event, index) => <button type="button" key={event.id} className={`${index === activeIndex ? 'is-active' : ''} ${(event.confidence ?? 1) < 0.7 ? 'is-uncertain' : ''}`} onClick={() => setActiveIndex(index)} style={{ left: `${event.beat * 72}px`, width: `${Math.max(54, event.duration * 68)}px` }}><strong>{event.note}</strong><small>{event.buttonId === 'unmapped' ? '?' : event.buttonId.match(/\d+$/)?.[0]}{event.direction === 'pull' ? 'T' : 'P'}</small>{(event.confidence ?? 1) < 0.7 && <AlertTriangle />}</button>)}</div>
      </section>

      <section className="studio-inspector">
        <div className="studio-preview"><div className="card-title-row"><div><small>APERÇU SUR TON INSTRUMENT</small><h2>{active ? `Temps ${active.beat + 1}` : 'Sélectionne une note'}</h2></div><span className={`status-pill ${(active?.confidence ?? 1) < 0.7 ? 'status-needs-review' : 'status-ready'}`}>{Math.round((active?.confidence ?? 1) * 100)} % de confiance</span></div>{active && <AccordionView config={accordion} activeEvent={active} direction={active.direction} notation="tablature" compact />}</div>
        {active && <aside className="event-inspector"><span className="eyebrow">Propriétés de la note</span><h2>{active.note}</h2><div className="inspector-grid"><label>Note<input value={active.note} onChange={(event) => updateEvent({ note: event.target.value })} /></label><label>MIDI<input type="number" value={active.midi} onChange={(event) => updateEvent({ midi: Number(event.target.value) })} /></label><label>Bouton<select value={active.buttonId} onChange={(event) => updateEvent({ buttonId: event.target.value })}>{active.buttonId === 'unmapped' && <option value="unmapped">Non assigné</option>}{accordion.buttons.map((button) => <option key={button.id} value={button.id}>Rang {button.row} · bouton {button.index}</option>)}</select></label><label>Direction<select value={active.direction} onChange={(event) => updateEvent({ direction: event.target.value as 'push' | 'pull' })}><option value="push">Pousser</option><option value="pull">Tirer</option></select></label><label>Doigt<select value={active.finger} onChange={(event) => updateEvent({ finger: Number(event.target.value) })}>{[2, 3, 4, 5].map((finger) => <option key={finger} value={finger}>{finger}</option>)}</select></label><label>Durée (temps)<input type="number" min="0.25" step="0.25" value={active.duration} onChange={(event) => updateEvent({ duration: Number(event.target.value) })} /></label></div>{(active.confidence ?? 1) < 0.7 && <div className="uncertain-note"><AlertTriangle /><span><strong>Passage incertain</strong>L’IA n’a pas trouvé cette note avec assez de certitude. Écoute la source et corrige-la avant de jouer.</span></div>}<button type="button" className="validate-event" onClick={() => updateEvent({ confidence: 1 })}><Check /> Valider cette note</button></aside>}
      </section>
    </main>
  );
}
