import { ArrowRight, Award, BellRing, CalendarDays, CheckCircle2, ChevronRight, CircleGauge, Clock3, Flame, Headphones, Music2, Play, Repeat2, Sparkles, Target } from 'lucide-react';
import type { AccordionConfig, Song } from '../types';
import { AccordionView } from './AccordionView';

interface HomePageProps {
  accordion: AccordionConfig;
  song: Song;
  onPractice: (song: Song) => void;
  onNavigateLearn: () => void;
}

export function HomePage({ accordion, song, onPractice, onNavigateLearn }: HomePageProps) {
  return (
    <main className="home-page page-content">
      <section className="hero-dashboard">
        <div className="hero-copy"><span className="eyebrow"><Sparkles size={15} /> Bonjour Robin, prêt pour quelques notes ?</span><h1>Un petit souffle,<br /><em>un grand pas.</em></h1><p>Ta séance d’aujourd’hui est courte et ciblée : stabiliser le passage entre pousser et tirer.</p><div className="hero-actions"><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> Commencer ma séance <span>12 min</span></button><button type="button" className="secondary-button" onClick={onNavigateLearn}>Voir mon parcours <ArrowRight /></button></div><div className="hero-reassurance"><span><CheckCircle2 /> Reprends là où tu t’es arrêté</span><span><Headphones /> Micro facultatif</span></div></div>
        <div className="hero-visual">
          <div className="daily-card"><div className="daily-card-head"><span><small>SÉANCE DU JOUR</small><strong>Pousser, tirer… respirer</strong></span><b>2 / 4</b></div><div className="lesson-preview"><AccordionView config={accordion} direction="pull" notation="tablature" compact /><span className="gesture-tip"><Repeat2 /> Un seul changement de direction aujourd’hui</span></div><div className="lesson-progress"><i><b style={{ width: '50%' }} /></i><span>6 min restantes</span></div></div>
          <span className="floating-badge badge-streak"><Flame /><b>3 jours</b><small>Ta série démarre !</small></span><span className="floating-badge badge-skill"><Award /><b>+1 compétence</b><small>Boutons 4 et 5</small></span>
        </div>
      </section>

      <section className="today-section">
        <div className="section-title"><div><span className="eyebrow">Aujourd’hui</span><h2>Ton chemin, étape par étape</h2></div><p>Une seule difficulté nouvelle. Le reste consolide ce que tu sais déjà.</p></div>
        <div className="lesson-roadmap">
          {[
            { icon: CheckCircle2, kind: 'done', n: '01', title: 'Échauffement', text: 'Retrouver les boutons 4 et 5', meta: '3 min · terminé' },
            { icon: Repeat2, kind: 'current', n: '02', title: 'Le changement de souffle', text: 'Passer de pousser à tirer sans couper la note', meta: '5 min · maintenant' },
            { icon: Music2, kind: 'next', n: '03', title: 'Trois notes qui dansent', text: 'Une mini-mélodie avec ton nouveau geste', meta: '4 min' },
            { icon: Target, kind: 'locked', n: '04', title: 'Petit défi', text: 'Jouer sans regarder les boutons', meta: '2 min' },
          ].map(({ icon: Icon, kind, n, title, text, meta }) => <button type="button" key={n} className={`roadmap-item is-${kind}`} onClick={() => kind !== 'locked' && onPractice(song)}><span className="roadmap-number">{kind === 'done' ? <CheckCircle2 /> : n}</span><span className="roadmap-icon"><Icon /></span><span><strong>{title}</strong><p>{text}</p><small><Clock3 /> {meta}</small></span>{kind === 'current' ? <b>Continuer <ChevronRight /></b> : kind !== 'locked' && <ChevronRight />}</button>)}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="progress-card"><div className="card-title-row"><div><span className="eyebrow">Cette semaine</span><h2>Ta régularité compte</h2></div></div><div className="week-chart">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`} className={index < 3 ? 'is-done' : index === 3 ? 'is-today' : ''}><i>{index < 3 && <CheckCircle2 />}{index === 3 && <b>8</b>}</i><small>{day}</small></span>)}</div><div className="week-stats"><span><strong>24 <small>min</small></strong>cette semaine</span><span><strong>3</strong>jours de suite</span><span><strong>86<small>%</small></strong>notes justes</span></div></article>
        <article className="review-card"><div className="review-icon"><BellRing /></div><span className="eyebrow">Révision intelligente</span><h2>Deux gestes à revoir</h2><p>Quelques minutes aujourd’hui suffiront pour les ancrer durablement.</p><div className="review-items"><span><i>4T</i><b>Passage bouton 4</b><small>Vu il y a 2 jours</small></span><span><i>5P</i><b>Attaque en pousser</b><small>À consolider</small></span></div><button type="button" className="secondary-button" onClick={() => onPractice(song)}>Lancer la révision <ArrowRight /></button></article>
      </section>

      <section className="quote-strip"><CircleGauge /><blockquote>« La régularité construit ce que la vitesse ne peut pas forcer. »<small>— Ton conseil de la semaine</small></blockquote><span><CalendarDays /> Prochaine étape : garder un tempo stable à 80 BPM</span></section>
    </main>
  );
}
