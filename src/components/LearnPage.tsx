import { BookOpen, Check, ChevronRight, Clock3, LockKeyhole, Play, Repeat2, Sparkles, Target, Trophy } from 'lucide-react';
import type { SkillProgress, Song } from '../types';

interface LearnPageProps { skills: SkillProgress[]; song: Song; onPractice: (song: Song) => void; }

export function LearnPage({ skills, song, onPractice }: LearnPageProps) {
  return (
    <main className="page-content learn-page">
      <header className="page-heading split-heading"><div><span className="eyebrow">Parcours débutant · Niveau 1</span><h1>Apprendre sans se perdre</h1><p>Chaque leçon n’ajoute qu’une nouveauté. Les révisions arrivent au bon moment.</p></div><div className="level-badge"><span><Trophy /></span><div><small>PROCHAIN PALIER</small><strong>Explorateur du soufflet</strong><i><b style={{ width: '68%' }} /></i><em>340 / 500 XP</em></div></div></header>
      <section className="current-lesson-card"><div className="current-copy"><span className="eyebrow"><Sparkles /> À continuer</span><h2>Le changement de souffle</h2><p>Tu sais déjà trouver les bons boutons. Maintenant, apprends à changer de direction sans couper le son.</p><div className="lesson-objective"><Target /><span><small>OBJECTIF MESURABLE</small><strong>Réussir 4 changements sur 5 à 72 BPM</strong></span></div><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> Continuer · 5 min</button></div><div className="current-visual"><div className="breath-illustration"><span>←</span><i>{Array.from({ length: 8 }).map((_, i) => <b key={i} />)}</i><span>→</span></div><div className="micro-goals"><span><Check /> Identifier pousser / tirer</span><span className="is-current"><Repeat2 /> Changer sans couper</span><span>○ Enchaîner trois notes</span></div></div></section>

      <div className="section-title"><div><span className="eyebrow">Carte des compétences</span><h2>Les fondations de ton jeu</h2></div><p>Les compétences s’ouvrent quand les précédentes sont assez solides.</p></div>
      <section className="skill-grid">{skills.map((skill, index) => <article key={skill.id} className={`skill-card ${skill.locked ? 'is-locked' : ''} ${skill.due ? 'is-due' : ''}`}><div className="skill-top"><span>{skill.locked ? <LockKeyhole /> : index + 1}</span>{skill.due && <b>À pratiquer</b>}</div><h3>{skill.title}</h3><p>{skill.description}</p><div className="skill-progress"><i><b style={{ width: `${skill.progress}%` }} /></i><span>{skill.progress}%</span></div><footer><span><BookOpen /> {skill.lessons} leçons</span><button type="button" disabled={skill.locked} onClick={() => onPractice(song)}>{skill.locked ? 'Bientôt' : skill.progress === 100 ? 'Réviser' : 'Continuer'} <ChevronRight /></button></footer></article>)}</section>

      <section className="pedagogy-card"><span><Repeat2 /></span><div><small>COMMENT ÇA MARCHE ?</small><h2>Ton parcours s’adapte à tes erreurs</h2><p>Une note hésitante revient demain. Un geste maîtrisé attend plus longtemps. Tu révises juste ce qu’il faut, au moment où ta mémoire en a besoin.</p></div></section>
      <section className="coming-roadmap"><div className="section-title"><div><span className="eyebrow">Plus loin</span><h2>Ce qui t’attend</h2></div></div><div>{['Rythme et enchaînements', 'Doigtés et gestion du soufflet', 'Premières basses', 'Coordination des deux mains', 'Nuances et interprétation'].map((title, index) => <span key={title}><i>{index + 2}</i><strong>{title}</strong><small><Clock3 /> Niveau {index + 2}</small></span>)}</div></section>
    </main>
  );
}
