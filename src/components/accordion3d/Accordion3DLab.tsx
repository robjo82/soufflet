import { ArrowLeft, ArrowRight, Box, Music2, Pause, Play, RotateCcw, Sparkles, Wind } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAccordion3DPlayback } from '../../accordion3dPlayback';
import { adaptSongToAccordion, DEMO_SONG, FALLBACK_ACCORDIONS, FRENCH_NOTES } from '../../data';
import { useSynth } from '../../hooks/useSynth';
import type { AccordionButton, BellowsStyle, Direction, Song } from '../../types';
import { BELLOWS_STYLE_OPTIONS, bellowsAmountLabel } from '../../bellowsStrategy';
import { AccordionView } from '../AccordionView';
import { Accordion3D } from './Accordion3D';
import { Accordion3DErrorBoundary } from './Accordion3DErrorBoundary';

function buttonLabel(button: AccordionButton, direction: Direction) {
  const note = direction === 'push' ? button.push : button.pull;
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  return match ? `${FRENCH_NOTES[match[1]] ?? match[1]}${match[2]}` : note;
}
export default function Accordion3DLab() {
  const accordion = useMemo(() => FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2')!, []);
  const fallbackSong = useMemo(() => adaptSongToAccordion(DEMO_SONG, accordion), [accordion]);
  const [bellowsAmount, setBellowsAmount] = useState(0.28);
  const [bellowsStyle, setBellowsStyle] = useState<BellowsStyle>('balanced');
  const [airValveActive, setAirValveActive] = useState(false);
  const [direction, setDirection] = useState<Direction>('pull');
  const [activeButtonIds, setActiveButtonIds] = useState<string[]>([]);
  const [songs, setSongs] = useState<Song[]>([fallbackSong]);
  const [selectedSongId, setSelectedSongId] = useState(fallbackSong.id);
  const [libraryState, setLibraryState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showLearningGuides, setShowLearningGuides] = useState(true);
  const timers = useRef<number[]>([]);
  const activeCounts = useRef(new Map<string, number>());
  const { playMidi, playLeftHand } = useSynth();

  const selectedSong = useMemo(
    () => adaptSongToAccordion(songs.find((song) => song.id === selectedSongId) ?? songs[0], accordion, bellowsStyle),
    [accordion, bellowsStyle, selectedSongId, songs],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    activeCounts.current.clear();
    setActiveButtonIds([]);
    setAirValveActive(false);
  }, []);

  const stopDemo = useCallback(() => {
    clearTimers();
    setDemoPlaying(false);
  }, [clearTimers]);

  const activateButton = useCallback((buttonId: string, durationMs: number) => {
    activeCounts.current.set(buttonId, (activeCounts.current.get(buttonId) ?? 0) + 1);
    setActiveButtonIds([...activeCounts.current.keys()]);
    const timer = window.setTimeout(() => {
      const count = (activeCounts.current.get(buttonId) ?? 1) - 1;
      if (count <= 0) activeCounts.current.delete(buttonId);
      else activeCounts.current.set(buttonId, count);
      setActiveButtonIds([...activeCounts.current.keys()]);
    }, durationMs);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/library', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('library-unavailable');
      const payload = await response.json() as { songs: Song[] };
      const compatible = payload.songs
        .filter((song) => song.status === 'ready' && song.events.length > 0)
        .map((song) => adaptSongToAccordion(song, accordion));
      const byId = new Map<string, Song>([[fallbackSong.id, fallbackSong]]);
      compatible.forEach((song) => byId.set(song.id, song));
      const nextSongs = [...byId.values()];
      setSongs(nextSongs);
      setSelectedSongId((current) => nextSongs.some((song) => song.id === current) ? current : nextSongs[0].id);
      setLibraryState('ready');
    }).catch((error: unknown) => {
      if ((error as { name?: string }).name !== 'AbortError') setLibraryState('fallback');
    });
    return () => controller.abort();
  }, [accordion, fallbackSong]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    activeCounts.current.clear();
  }, []);

  const press = (buttonId: string) => {
    const button = [...accordion.buttons, ...accordion.basses].find((item) => item.id === buttonId);
    if (!button) return;
    activateButton(buttonId, 520);
    playMidi(direction === 'push' ? button.pushMidi : button.pullMidi, 0.65, 0.08);
  };

  const playDemo = () => {
    if (!selectedSong) return;
    stopDemo();
    const playback = createAccordion3DPlayback(selectedSong);
    setBellowsAmount(selectedSong.bellowsPlan?.startAmount ?? .38);
    setDemoPlaying(true);
    playback.airCues.forEach((cue) => {
      const timer = window.setTimeout(() => {
        setAirValveActive(true);
        setBellowsAmount(cue.toAmount);
        const releaseTimer = window.setTimeout(() => setAirValveActive(false), cue.durationMs);
        timers.current.push(releaseTimer);
      }, cue.atMs);
      timers.current.push(timer);
    });
    playback.cues.forEach((cue) => {
      const timer = window.setTimeout(() => {
        setDirection(cue.direction);
        activateButton(cue.buttonId, cue.durationMs);
        if (cue.hand === 'right') {
          if (cue.bellowsAfter !== undefined) setBellowsAmount(cue.bellowsAfter);
          playMidi(cue.midi, cue.durationMs / 1000, .08);
        } else if (cue.role !== 'melody') {
          playLeftHand(cue.midi, cue.role, cue.chord, cue.durationMs / 1000);
        }
      }, cue.atMs);
      timers.current.push(timer);
    });
    const endTimer = window.setTimeout(() => {
      activeCounts.current.clear();
      setActiveButtonIds([]);
      setDemoPlaying(false);
      timers.current = [];
    }, playback.durationMs + 80);
    timers.current.push(endTimer);
  };

  const activeEvent = selectedSong?.events.find((event) => activeButtonIds.includes(event.buttonId));
  const fallback = <AccordionView config={accordion} activeEvent={activeEvent} notation="french" direction={direction} compact depressActive bellowsAmount={bellowsAmount} airValveActive={airValveActive} onButtonPress={press} />;

  return (
    <main className="accordion-3d-lab">
      <header className="accordion-3d-lab-header">
        <div>
          <span className="eyebrow"><Box size={16} /> Laboratoire interne</span>
          <h1>Hohner Club Modell I · contrat 3D</h1>
          <p>Teste le mouvement du soufflet, la visibilité des boutons et la synchronisation avec les morceaux de la bibliothèque.</p>
        </div>
        <a className="secondary-button" href="/"><ArrowLeft size={18} /> Revenir à Soufflet</a>
      </header>

      <div className="accordion-3d-workspace">
        <section className="accordion-3d-stage">
          <span className="accordion-3d-revision">Vague organique · modèle v3</span>
          <Accordion3DErrorBoundary fallback={fallback}>
            {showFallback ? fallback : (
              <Accordion3D
                bellowsAmount={bellowsAmount}
                activeButtonIds={activeButtonIds}
                direction={direction}
                airValveActive={airValveActive}
                showLearningGuides={showLearningGuides}
                onButtonPress={press}
                allowOrbit
              />
            )}
          </Accordion3DErrorBoundary>
        </section>

        <aside className="accordion-3d-inspector" aria-label="Commandes du laboratoire 3D">
          <div className="accordion-3d-inspector-heading">
            <div><small>PUPITRE DE TEST</small><h2>Commande et repères</h2></div>
            <span>{direction === 'pull' ? 'Tirer · ouvrir' : 'Pousser · fermer'}</span>
          </div>

          <section className="accordion-3d-controls" aria-label="Commandes de test du modèle 3D">
            <div className="accordion-3d-demo">
              <label htmlFor="accordion-3d-song">
                <Music2 aria-hidden="true" />
                <span><small>MÉLODIE DE LA BIBLIOTHÈQUE</small><strong>{songs.length} morceau{songs.length > 1 ? 'x' : ''} compatible{songs.length > 1 ? 's' : ''}</strong></span>
              </label>
              <select
                id="accordion-3d-song"
                value={selectedSongId}
                onChange={(event) => { stopDemo(); setSelectedSongId(event.target.value); }}
                disabled={libraryState === 'loading'}
              >
                {songs.map((song) => <option key={song.id} value={song.id}>{song.title} · {song.artist}</option>)}
              </select>
              <button type="button" className={demoPlaying ? 'is-playing' : ''} onClick={demoPlaying ? stopDemo : playDemo}>
                {demoPlaying ? <><Pause fill="currentColor" /> Arrêter</> : <><Play fill="currentColor" /> Voir jouer</>}
              </button>
              <small className="accordion-3d-library-state">
                {libraryState === 'loading' && 'Chargement de la bibliothèque…'}
                {libraryState === 'ready' && 'Mélodie, accompagnement et soufflet sont synchronisés.'}
                {libraryState === 'fallback' && 'Bibliothèque privée indisponible : exercice de démonstration chargé.'}
              </small>
            </div>
            <div className="accordion-3d-strategy">
              <label htmlFor="accordion-3d-strategy"><Wind /><span><small>STRATÉGIE DE SOUFFLET</small><strong>{BELLOWS_STYLE_OPTIONS.find((option) => option.id === bellowsStyle)?.short}</strong></span></label>
              <select id="accordion-3d-strategy" value={bellowsStyle} disabled={demoPlaying} onChange={(event) => { stopDemo(); setBellowsStyle(event.target.value as BellowsStyle); }}>
                {BELLOWS_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.short}</option>)}
              </select>
              {selectedSong.bellowsPlan && <p><b>{selectedSong.bellowsPlan.directionChanges}</b> changements · <b>{selectedSong.bellowsPlan.airActions}</b> soupapes · {bellowsAmountLabel(bellowsAmount)}</p>}
            </div>
            <div className="accordion-3d-control-row">
              <label htmlFor="bellows-amount">
                <span>Ouverture du soufflet</span>
                <strong>{Math.round(bellowsAmount * 100)} %</strong>
              </label>
              <input id="bellows-amount" type="range" min="0" max="1" step="0.01" value={bellowsAmount} onChange={(event) => setBellowsAmount(Number(event.target.value))} />
            </div>
            <div className="accordion-3d-toolbar">
              <button type="button" className={direction === 'push' ? 'is-active' : ''} onClick={() => setDirection('push')}><ArrowRight /> Pousser</button>
              <button type="button" className={direction === 'pull' ? 'is-active' : ''} onClick={() => setDirection('pull')}><ArrowLeft /> Tirer</button>
              <button type="button" className={showLearningGuides ? 'is-guide-active' : ''} aria-pressed={showLearningGuides} onClick={() => setShowLearningGuides((value) => !value)}><Sparkles /> Guides bleus</button>
              <button type="button" onClick={() => { stopDemo(); setBellowsAmount(0); }}><RotateCcw /> Fermer</button>
              <button type="button" onClick={() => setShowFallback((value) => !value)}>{showFallback ? 'Afficher la 3D' : 'Repli 2D'}</button>
            </div>
          </section>

          <section className="accordion-3d-buttons">
            <div>
              <h2>Main droite · 10 + 9 + 2</h2>
              <div className="accordion-3d-button-grid">
                {accordion.buttons.map((button) => (
                  <button type="button" className={activeButtonIds.includes(button.id) ? 'is-active' : ''} key={button.id} onClick={() => press(button.id)}>
                    <small>{button.id}</small><strong>{buttonLabel(button, direction)}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2>Main gauche · basses et accords</h2>
              <div className="accordion-3d-button-grid is-bass">
                {accordion.basses.map((button) => (
                  <button type="button" className={activeButtonIds.includes(button.id) ? 'is-active' : ''} key={button.id} onClick={() => press(button.id)}>
                    <small>{button.id}</small><strong>{button.role === 'bass' ? 'Basse' : 'Accord'}</strong>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
