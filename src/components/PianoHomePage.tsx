import { BookOpen, Hand, Library, Music2, Piano, Play, Usb } from 'lucide-react';
import type { PianoConfig, PracticeStats, Song } from '../types';

interface PianoHomePageProps {
  piano: PianoConfig;
  song?: Song;
  stats: PracticeStats | null;
  displayName: string;
  onPractice: (song: Song) => void;
  onNavigate: (page: 'learn' | 'library' | 'settings') => void;
}

export function PianoHomePage({ piano, song, stats, displayName, onPractice, onNavigate }: PianoHomePageProps) {
  return <main className="page-content piano-home">
    <header className="piano-home-hero"><div><span className="eyebrow"><Piano /> Parcours piano</span><h1>Bonjour {displayName},<br />pose tes mains.</h1><p>Mélodie et accompagnement avancent sur deux pistes indépendantes. Commence main droite, puis ajoute la gauche quand les notes deviennent naturelles.</p><div>{song && <button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> Jouer {song.title}</button>}<button type="button" className="secondary-button" onClick={() => onNavigate('library')}><Library /> Bibliothèque commune</button></div></div><div className="piano-home-instrument"><Piano /><strong>{piano.name}</strong><span>{piano.keyboardSize} touches · {piano.input === 'midi' ? 'entrée MIDI' : piano.input === 'microphone' ? 'microphone' : 'clavier ordinateur'}</span><button type="button" onClick={() => onNavigate('settings')}><Usb /> Configurer l’entrée</button></div></header>
    <section className="piano-learning-path"><article><span>1</span><Hand /><h2>Main droite</h2><p>Repère le Do central, lis cinq notes et apprends un doigté stable.</p><button type="button" onClick={() => onNavigate('learn')}>Commencer <BookOpen /></button></article><article><span>2</span><Music2 /><h2>Main gauche</h2><p>Installe basses et accords sur une pulsation distincte de la mélodie.</p><button type="button" onClick={() => onNavigate('learn')}>Découvrir <BookOpen /></button></article><article><span>3</span><Piano /><h2>Deux mains</h2><p>Réunis les deux rythmes progressivement, sans accélérer trop tôt.</p><button type="button" onClick={() => onNavigate('library')}>Choisir un morceau <Library /></button></article></section>
    <section className="piano-home-stats"><div><small>Pratique totale</small><strong>{stats ? Math.round(stats.overview.totalSeconds / 60) : 0} min</strong></div><div><small>Notes évaluées</small><strong>{stats?.overview.assessedNotes ?? 0}</strong></div><div><small>Précision</small><strong>{stats?.overview.pitchAccuracy === null || stats?.overview.pitchAccuracy === undefined ? '—' : `${stats.overview.pitchAccuracy}%`}</strong></div></section>
  </main>;
}
