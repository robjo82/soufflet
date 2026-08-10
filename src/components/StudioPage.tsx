import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock3, Cloud, ExternalLink, History, Music2, Piano, Play, Redo2, Save, Scissors, Sparkles, Undo2, WandSparkles } from 'lucide-react';
import type { AccordionConfig, InstrumentType, PianoConfig, Song, SongEvent } from '../types';
import { AccordionInstrument } from './AccordionInstrument';
import { adaptSongToAccordion } from '../data';
import { bellowsAmountLabel, bellowsStepAt } from '../bellowsStrategy';
import { PianoKeyboard } from './PianoKeyboard';
import { pianoRange } from '../piano';
import { useSynth } from '../hooks/useSynth';

interface StudioPageProps {
  songs: Song[];
  initialSong?: Song;
  accordion: AccordionConfig;
  instrumentType: InstrumentType;
  piano?: PianoConfig;
  onSave: (song: Song) => Promise<void>;
  onPractice: (song: Song) => void;
}

export function StudioPage({ songs, initialSong, accordion, instrumentType, piano, onSave, onPractice }: StudioPageProps) {
  const editableSongs = songs.filter((song) => song.events.length > 0);
  const [song, setSong] = useState<Song>(initialSong ?? editableSongs[0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [history, setHistory] = useState<Song[]>([]);
  const active = song?.events[activeIndex];
  const deferredSong = useDeferredValue(song);
  const plannedSong = useMemo(() => deferredSong ? adaptSongToAccordion(deferredSong, accordion) : undefined, [accordion, deferredSong]);
  const plannedActive = plannedSong?.events[activeIndex];
  const bellowsStep = plannedSong ? bellowsStepAt(plannedSong, plannedActive) : undefined;
  const pianoEvent = song?.arrangements?.piano?.events.find((event) => event.sourceEventId === active?.id)
    ?? song?.arrangements?.piano?.events.find((event) => event.hand === 'right' && event.beat === active?.beat);
  const pianoMidis = piano ? pianoRange(piano.keyboardSize) : [];
  const { playPianoMidi } = useSynth();

  useEffect(() => { if (initialSong) { setSong(initialSong); setActiveIndex(0); } }, [initialSong]);
  useEffect(() => {
    if (!song || saveState !== 'saving') return;
    const timer = window.setTimeout(() => {
      void onSave(song).then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 1200);
    return () => clearTimeout(timer);
  }, [onSave, saveState, song]);

  if (!song) return <main className="page-content empty-studio"><WandSparkles /><h1>Le studio est prêt</h1><p>{instrumentType === 'accordion' ? 'Importe un morceau pour corriger les notes, le rythme, les doigtés et le soufflet.' : instrumentType === 'piano' ? 'Importe un morceau pour corriger les notes, le rythme, les doigtés et la répartition entre les mains.' : 'Importe un morceau pour corriger les notes, le rythme, les cordes et les doigtés.'}</p></main>;
  const finalBeat = Math.max(0, ...song.events.map((event) => event.beat + event.duration), ...(song.accompaniment ?? []).map((event) => event.beat + event.duration));
  const measureCount = Math.max(1, Math.ceil(finalBeat / song.timeSignature[0]));
  const measureWidth = song.timeSignature[0] * 72;
  const timelineWidth = Math.max(1800, measureCount * measureWidth);

  const updateEvent = (patch: Partial<SongEvent>) => {
    setHistory((items) => [...items.slice(-19), song]);
    setSong({ ...song, events: song.events.map((event, index) => index === activeIndex ? { ...event, ...patch } : event), status: 'needs-review' });
    setSaveState('saving');
  };
  const undo = () => {
    const previous = history.at(-1); if (!previous) return;
    setSong(previous); setHistory((items) => items.slice(0, -1)); setSaveState('saving');
  };

  return (
    <main className="studio-page">
      <header className="studio-header"><div><span className="eyebrow"><Sparkles /> {instrumentType === 'piano' ? 'Éditeur d’arrangement piano' : instrumentType === 'guitar' ? 'Éditeur d’arrangement guitare' : 'Éditeur de tablature'}</span><h1>Studio</h1></div><label className="song-select"><Music2 /><span><small>MORCEAU OUVERT</small><select value={song.id} onChange={(event) => { const next = editableSongs.find((item) => item.id === event.target.value); if (next) { setSong(next); setActiveIndex(0); } }}>{editableSongs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></span><ChevronDown /></label><div className="studio-actions"><button type="button" className="icon-button" onClick={undo} disabled={!history.length} title="Annuler"><Undo2 /></button><button type="button" className="icon-button" disabled title="Rétablir"><Redo2 /></button><span className={`save-state ${saveState === 'error' ? 'is-error' : ''}`}>{saveState === 'saved' ? <><Cloud /> Sauvegardé dans ton compte</> : saveState === 'error' ? <><AlertTriangle /> Non synchronisé · réessaie en modifiant une note</> : <><Save /> Sauvegarde…</>}</span><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> Tester</button></div></header>

      {(song.transcriptionMethod === 'verified-library' || song.transcriptionMethod === 'gemini-preview' || song.transcriptionMethod === 'multimodal-research') && (
        <section className={`transcription-source-note ${song.transcriptionMethod === 'verified-library' ? 'is-verified' : song.transcriptionMethod === 'multimodal-research' ? 'is-researched' : 'is-preview'}`}>
          {song.transcriptionMethod === 'verified-library' ? <Check /> : <AlertTriangle />}
          <span>
            <strong>{song.transcriptionMethod === 'verified-library' ? 'Édition reconnue dans la bibliothèque vérifiée' : song.transcriptionMethod === 'multimodal-research' ? 'Transcription multimodale documentée — contrôle humain conseillé' : 'Transcription YouTube expérimentale — vérification obligatoire'}</strong>
            <small>{song.transcriptionWarnings?.join(' ')}</small>
          </span>
          {song.sourceUrl && <a href={song.sourceUrl} target="_blank" rel="noreferrer">Écouter la source</a>}
        </section>
      )}

      {song.transcriptionMethod === 'multimodal-research' && (
        <section className="transcription-report" aria-label="Rapport de transcription">
          <div className="transcription-report-metrics">
            <span><small>COUVERTURE</small><strong>{song.transcriptionCoverage?.sourceDurationSeconds ? `${Math.round(song.transcriptionCoverage.ratio * 100)} %` : 'À confirmer'}</strong></span>
            <span><small>MAIN DROITE</small><strong>{song.events.length} notes</strong></span>
            <span><small>MAIN GAUCHE</small><strong>{song.accompaniment?.length ?? 0} gestes</strong></span>
            <span><small>SOURCES CROISÉES</small><strong>{song.transcriptionSources?.length ?? 0}</strong></span>
          </div>
          {Boolean(song.transcriptionSources?.length) && <div className="transcription-sources"><small>SOURCES UTILISÉES</small>{song.transcriptionSources?.slice(0, 5).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><b>{source.title}</b><i>{source.kind.toUpperCase()} · {source.usedFor}</i></span><ExternalLink /></a>)}</div>}
        </section>
      )}

      <div className="studio-toolbar"><button type="button" className="is-active"><Music2 /> Note</button><button type="button"><Scissors /> Découper</button><button type="button"><Clock3 /> Durée</button><span /><button type="button"><History /> Historique</button><span className="confidence-legend"><i /> Incertain · vérification nécessaire</span></div>

      <section className="studio-timeline">
        <div className="timeline-ruler"><b />{Array.from({ length: measureCount }).map((_, index) => <span key={index} style={{ width: `${measureWidth}px`, flexBasis: `${measureWidth}px` }}>Mesure {index + 1}</span>)}</div>
        <div className="timeline-lane"><strong>Main droite</strong><div className="timeline-track" style={{ width: `${timelineWidth}px` }}>{song.events.map((event, index) => { const pianoTimelineEvent = song.arrangements?.piano?.events.find((candidate) => candidate.sourceEventId === event.id) ?? song.arrangements?.piano?.events.find((candidate) => candidate.hand === 'right' && candidate.beat === event.beat); return <button type="button" key={event.id} className={`${index === activeIndex ? 'is-active' : ''} ${(event.confidence ?? 1) < 0.7 ? 'is-uncertain' : ''}`} onClick={() => setActiveIndex(index)} style={{ left: `${event.beat * 72}px`, width: `${Math.max(54, event.duration * 68)}px` }}><strong>{event.note}</strong><small>{instrumentType === 'piano' ? pianoTimelineEvent?.fingers?.length ? `Doigt ${pianoTimelineEvent.fingers.join('-')}` : 'Piano' : instrumentType === 'guitar' ? 'Mélodie' : `${event.buttonId === 'unmapped' ? '?' : event.buttonId.match(/\d+$/)?.[0]}${event.direction === 'pull' ? 'T' : 'P'}`}</small>{(event.confidence ?? 1) < 0.7 && <AlertTriangle />}</button>; })}</div></div>
        <div className="timeline-lane is-left-hand"><strong>Main gauche</strong><div className="timeline-track" style={{ width: `${timelineWidth}px` }}>{song.accompaniment?.map((event) => <span key={event.id} className={(event.confidence ?? 1) < .7 ? 'is-uncertain' : ''} style={{ left: `${event.beat * 72}px`, width: `${Math.max(48, event.duration * 68)}px` }}><b>{event.chord}</b><small>{event.role === 'bass' ? 'Basse' : 'Accord'}</small>{(event.confidence ?? 1) < .7 && <AlertTriangle />}</span>)}</div></div>
      </section>

      <section className="studio-inspector">
        <div className={`studio-preview studio-preview-${instrumentType}`}><div className="card-title-row"><div><small>APERÇU SUR TON INSTRUMENT</small><h2>{active ? `Temps ${active.beat + 1}` : 'Sélectionne une note'}</h2></div><span className={`status-pill ${(active?.confidence ?? 1) < 0.7 ? 'status-needs-review' : 'status-ready'}`}>{Math.round((active?.confidence ?? 1) * 100)} % de confiance</span></div>{instrumentType === 'piano' && piano ? <div className="studio-piano-preview"><Piano /><strong>{pianoEvent?.label ?? active?.note ?? '—'}</strong><span>{pianoEvent?.hand === 'left' ? 'Main gauche' : 'Main droite'}{pianoEvent?.fingers?.length ? ` · doigt ${pianoEvent.fingers.join('-')}` : ''}</span><PianoKeyboard midis={pianoMidis} expected={pianoEvent?.midis ?? (active ? [active.midi] : [])} notation={piano.notation} onHit={(midi) => playPianoMidi(midi)} /></div> : plannedActive && <><AccordionInstrument config={accordion} activeEvent={plannedActive} direction={plannedActive.direction} notation="tablature" compact bellowsAmount={bellowsStep?.afterAmount} airValveActive={Boolean(bellowsStep?.airBefore)} context="studio" />{bellowsStep && <p className="studio-bellows-advice"><b>{bellowsStep.airBefore ? 'Respiration : utilise la soupape avant cette note.' : bellowsAmountLabel(bellowsStep.afterAmount)}</b><span>Ouverture prévue : {Math.round(bellowsStep.afterAmount * 100)} % · plan équilibré sur le morceau entier</span></p>}</>}</div>
        {active && <aside className="event-inspector"><span className="eyebrow">Propriétés de la note</span><h2>{active.note}</h2><div className="inspector-grid"><label>Note<input value={active.note} onChange={(event) => updateEvent({ note: event.target.value })} /></label><label>MIDI<input type="number" value={active.midi} onChange={(event) => updateEvent({ midi: Number(event.target.value) })} /></label>{instrumentType === 'accordion' && <><label>Bouton<select value={active.buttonId} onChange={(event) => updateEvent({ buttonId: event.target.value })}>{active.buttonId === 'unmapped' && <option value="unmapped">Non assigné</option>}{accordion.buttons.map((button) => <option key={button.id} value={button.id}>Rang {button.row} · bouton {button.index}</option>)}</select></label><label>Direction<select value={active.direction} onChange={(event) => updateEvent({ direction: event.target.value as 'push' | 'pull' })}><option value="push">Pousser</option><option value="pull">Tirer</option></select></label><label>Doigt<select value={active.finger} onChange={(event) => updateEvent({ finger: Number(event.target.value) })}>{[2, 3, 4, 5].map((finger) => <option key={finger} value={finger}>{finger}</option>)}</select></label></>}{instrumentType === 'piano' && <><label>Main<input readOnly value={pianoEvent?.hand === 'left' ? 'Gauche' : 'Droite'} /></label><label>Doigt conseillé<input readOnly value={pianoEvent?.fingers?.join('-') || 'À calculer'} /></label></>}<label>Durée (temps)<input type="number" min="0.25" step="0.25" value={active.duration} onChange={(event) => updateEvent({ duration: Number(event.target.value) })} /></label></div>{(active.confidence ?? 1) < 0.7 && <div className="uncertain-note"><AlertTriangle /><span><strong>Passage incertain</strong>L’IA n’a pas trouvé cette note avec assez de certitude. Écoute la source et corrige-la avant de jouer.</span></div>}<button type="button" className="validate-event" onClick={() => updateEvent({ confidence: 1 })}><Check /> Valider cette note</button></aside>}
      </section>
    </main>
  );
}
