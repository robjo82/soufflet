import { ArrowRight, CheckCircle2, Guitar, Hand, Music2, TimerReset } from 'lucide-react';
import type { Song } from '../types';

export function GuitarLearnPage({ songs, onPractice }: { songs: Song[]; onPractice: (song: Song) => void }) {
  const playable = songs.filter((song) => song.status === 'ready' && song.arrangements?.guitar);
  const chapters = [
    { icon: Guitar, level: 'Fondations', title: 'Six cordes et douze cases', text: 'Apprends à lire une tablature et retrouve les cordes à vide.' },
    { icon: Hand, level: 'Main gauche', title: 'Un doigt par case', text: 'Pose près de la frette, sans écraser les cordes voisines.' },
    { icon: TimerReset, level: 'Main droite', title: 'Battements réguliers', text: 'Travaille les allers simples avant d’alterner aller et retour.' },
    { icon: Music2, level: 'Harmonie', title: 'Tes premiers accords', text: 'Enchaîne Em, G, C et D avec le moins de mouvements possible.' },
  ];
  return <main className="page-content guitar-learn"><header className="page-heading"><span className="eyebrow">Parcours progressif · Guitare</span><h1>Du premier son au premier morceau.</h1><p>Le micro vérifie la hauteur et estime les accords. Les exercices séparent placement, rythme et coordination avant de tout réunir.</p></header><section className="guitar-chapters">{chapters.map(({ icon: Icon, level, title, text }, index) => <article key={title}><span>{index + 1}</span><Icon /><small>{level}</small><h2>{title}</h2><p>{text}</p><div><CheckCircle2 /> Objectif vérifiable au micro</div>{playable[index] && <button type="button" onClick={() => onPractice(playable[index])}>Essayer avec {playable[index].title} <ArrowRight /></button>}</article>)}</section></main>;
}
