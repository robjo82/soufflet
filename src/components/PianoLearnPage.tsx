import { ArrowRight, CheckCircle2, Hand, Music2, Piano, TimerReset } from 'lucide-react';
import type { Song } from '../types';

export function PianoLearnPage({ songs, onPractice }: { songs: Song[]; onPractice: (song: Song) => void }) {
  const playable = songs.filter((song) => song.status === 'ready' && song.arrangements?.piano);
  const chapters = [
    { icon: Piano, title: 'Le clavier et le Do central', text: 'Repère les groupes de deux et trois touches noires, puis trouve tous les Do.', level: 'Fondations' },
    { icon: Hand, title: 'Cinq notes, cinq doigts', text: 'Installe pouce à auriculaire sans déplacer la main et joue Do–Ré–Mi–Fa–Sol.', level: 'Main droite' },
    { icon: TimerReset, title: 'Une pulsation régulière', text: 'Garde chaque note pendant sa durée, d’abord sans accompagnement.', level: 'Rythme' },
    { icon: Music2, title: 'Basses et accords', text: 'Fais vivre la main gauche sur sa propre piste avant de réunir les mains.', level: 'Main gauche' },
  ];
  return <main className="page-content piano-learn"><header className="page-heading"><span className="eyebrow">Parcours progressif · Piano</span><h1>Une difficulté à la fois.</h1><p>Chaque étape prépare la suivante. Le MIDI permet une évaluation polyphonique ; le micro accompagne les exercices note par note.</p></header><section className="piano-chapters">{chapters.map(({ icon: Icon, title, text, level }, index) => <article key={title}><span>{index + 1}</span><Icon /><small>{level}</small><h2>{title}</h2><p>{text}</p><div><CheckCircle2 /> Objectif clair et mesurable</div>{playable[index] && <button type="button" onClick={() => onPractice(playable[index])}>Essayer avec {playable[index].title} <ArrowRight /></button>}</article>)}</section></main>;
}
