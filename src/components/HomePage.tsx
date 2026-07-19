import {
  Activity, ArrowRight, Award, BarChart3, CalendarDays, CheckCircle2, Clock3, Flame,
  Gauge, Headphones, Lightbulb, Music2, Play, Repeat2, Sparkles, Target, TrendingUp,
} from 'lucide-react';
import type { AccordionConfig, PracticeSessionInput, PracticeStats, Song } from '../types';
import { AccordionInstrument } from './AccordionInstrument';
import { practiceModeLabel } from '../practiceModes';

interface HomePageProps {
  accordion: AccordionConfig;
  song: Song;
  stats: PracticeStats | null;
  onPractice: (song: Song) => void;
  onNavigateLearn: () => void;
  displayName: string;
}

const HAND_LABELS: Record<PracticeSessionInput['hand'], string> = { right: 'mélodie', left: 'basses', both: 'deux mains' };

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0 min';
  if (seconds < 60) return '< 1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h${remainder ? ` ${remainder} min` : ''}`;
}

function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(`${date}T12:00:00`));
}

function sessionAccuracy(session: PracticeSessionInput) {
  const correct = session.correctCount + session.earlyCount + session.lateCount;
  const total = correct + session.wrongCount;
  return total ? Math.round(correct / total * 100) : null;
}

function StatValue({ value, suffix }: { value: number | null | undefined; suffix?: string }) {
  return <strong>{value === null || value === undefined ? '—' : value}{value !== null && value !== undefined && suffix ? <small>{suffix}</small> : null}</strong>;
}

export function HomePage({ accordion, song, stats, onPractice, onNavigateLearn, displayName }: HomePageProps) {
  const hasData = stats?.hasData === true;
  const overview = stats?.overview;
  const maxDaySeconds = Math.max(1, ...(stats?.week.map((day) => day.activeSeconds) ?? [1]));
  const maxTrendSeconds = Math.max(1, ...(stats?.trends.map((week) => week.activeSeconds) ?? [1]));
  const today = new Date().toLocaleDateString('sv-SE');
  const skillCards = stats ? [
    { icon: Music2, label: 'Hauteur des notes', value: stats.skills.notes.value, suffix: '%', progress: stats.skills.notes.value ?? 0, detail: stats.skills.notes.sampleSize ? `${stats.skills.notes.sampleSize} notes évaluées` : 'Active le micro pour la mesurer' },
    { icon: Repeat2, label: 'Placement rythmique', value: stats.skills.rhythm.value, suffix: '%', progress: stats.skills.rhythm.value ?? 0, detail: stats.skills.rhythm.sampleSize ? `${stats.skills.rhythm.sampleSize} attaques mesurées` : 'Aucune attaque mesurée' },
    { icon: Gauge, label: 'Tempo pratiqué', value: stats.skills.tempo.value, suffix: '%', progress: stats.skills.tempo.value ?? 0, detail: stats.skills.tempo.sampleSize ? `Moyenne sur ${stats.skills.tempo.sampleSize} séance${stats.skills.tempo.sampleSize > 1 ? 's' : ''}` : 'Aucune séance enregistrée' },
    { icon: CalendarDays, label: 'Régularité', value: stats.skills.regularity.value, suffix: '/28 j', progress: stats.skills.regularity.value / 28 * 100, detail: 'Jours actifs sur les 4 dernières semaines' },
  ] : [];

  return (
    <main className="home-page page-content">
      <section className="hero-dashboard">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Bonjour {displayName}</span>
          <h1>{hasData ? <>Un petit souffle,<br /><em>un progrès mesuré.</em></> : <>Ton apprentissage<br /><em>commence ici.</em></>}</h1>
          <p>{stats === null ? 'Nous préparons ton suivi personnel…' : hasData ? `Tu as pratiqué ${formatDuration(overview!.weekSeconds)} cette semaine. La prochaine séance consolide les gestes réellement observés.` : 'Ton tableau de bord démarre volontairement à zéro. Dès ta première séance, le temps actif et les résultats réellement entendus apparaîtront ici.'}</p>
          <div className="hero-actions"><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play fill="currentColor" /> {hasData ? 'Continuer à pratiquer' : 'Faire ma première séance'} <span>micro guidé</span></button><button type="button" className="secondary-button" onClick={onNavigateLearn}>Voir mon parcours <ArrowRight /></button></div>
          <div className="hero-reassurance"><span><CheckCircle2 /> Temps actif uniquement</span><span><Headphones /> Évaluation micro locale</span><span><BarChart3 /> Aucun chiffre simulé</span></div>
        </div>
        <div className="hero-visual">
          <div className="daily-card">
            <div className="daily-card-head"><span><small>{hasData ? 'PROCHAINE SÉANCE' : 'PREMIER OBJECTIF'}</small><strong>Pousser, tirer… respirer</strong></span><b>{hasData ? overview!.totalSessions + 1 : '01'}</b></div>
            <div className="lesson-preview"><AccordionInstrument config={accordion} direction="pull" notation="tablature" compact context="lesson" showLearningGuides={false} /><span className="gesture-tip"><Target /> Une difficulté à la fois</span></div>
            <div className="lesson-progress"><Clock3 /> <span>{hasData ? `${formatDuration(overview!.weekSeconds)} de pratique réelle cette semaine` : 'Tes premières secondes seront comptées au démarrage'}</span></div>
          </div>
          <span className="floating-badge badge-streak"><Flame /><b>{overview?.currentStreak ?? 0} jour{overview?.currentStreak === 1 ? '' : 's'}</b><small>{hasData ? 'série actuelle' : 'série à commencer'}</small></span>
          <span className="floating-badge badge-skill"><Award /><b>{overview?.assessedNotes ?? 0} note{overview?.assessedNotes === 1 ? '' : 's'}</b><small>réellement évaluées</small></span>
        </div>
      </section>

      <section className="analytics-section" aria-busy={stats === null}>
        <div className="section-title"><div><span className="eyebrow"><Activity /> Suivi de l’apprentissage</span><h2>Des progrès fondés sur ta pratique</h2></div><p>Le temps correspond uniquement aux périodes de lecture active. La précision n’apparaît qu’après des notes réellement évaluées.</p></div>

        <div className="analytics-overview">
          <article><Clock3 /><span><small>CETTE SEMAINE</small>{stats ? <strong>{formatDuration(overview!.weekSeconds)}</strong> : <strong>—</strong>}<em>{overview?.totalSessions ?? 0} séance{overview?.totalSessions === 1 ? '' : 's'} au total</em></span></article>
          <article><Flame /><span><small>SÉRIE ACTUELLE</small><StatValue value={overview?.currentStreak} suffix=" j" /><em>Record : {overview?.longestStreak ?? 0} jour{overview?.longestStreak === 1 ? '' : 's'}</em></span></article>
          <article><Music2 /><span><small>NOTES JUSTES</small><StatValue value={overview?.pitchAccuracy} suffix=" %" /><em>{overview?.assessedNotes ?? 0} note{overview?.assessedNotes === 1 ? '' : 's'} analysée{overview?.assessedNotes === 1 ? '' : 's'}</em></span></article>
          <article><Target /><span><small>RÉPERTOIRE PRATIQUÉ</small><StatValue value={overview?.songsPracticed} /><em>{overview?.activeDays ?? 0} jour{overview?.activeDays === 1 ? '' : 's'} actif{overview?.activeDays === 1 ? '' : 's'} au total</em></span></article>
        </div>

        {!stats?.hasData && stats !== null && <div className="analytics-empty"><BarChart3 /><div><strong>Tout est prêt, sans historique inventé</strong><p>Commence une séance puis joue au moins quelques secondes. Le graphique, les compétences et les conseils se construiront uniquement avec tes données.</p></div><button type="button" className="primary-button" onClick={() => onPractice(song)}><Play /> Démarrer</button></div>}

        <div className="analytics-grid">
          <article className="analytics-card weekly-activity-card">
            <header><div><span className="eyebrow">7 jours</span><h3>Temps de pratique</h3></div><strong>{stats ? formatDuration(overview!.weekSeconds) : '—'}</strong></header>
            <div className="activity-bars">
              {(stats?.week ?? []).map((day) => <span key={day.date} className={day.date === today ? 'is-today' : ''} title={`${dateLabel(day.date, { dateStyle: 'long' })} : ${formatDuration(day.activeSeconds)}`}><i><b style={{ height: `${day.activeSeconds ? Math.max(8, day.activeSeconds / maxDaySeconds * 100) : 0}%` }} /></i><small>{dateLabel(day.date, { weekday: 'narrow' })}</small><em>{day.activeSeconds ? Math.max(1, Math.round(day.activeSeconds / 60)) : 0}</em></span>)}
              {stats === null && Array.from({ length: 7 }, (_, index) => <span key={index}><i /><small>—</small><em>0</em></span>)}
            </div>
            <footer>Minutes par jour <span>Une pause ne gonfle jamais le total.</span></footer>
          </article>

          <article className="analytics-card insight-card">
            <header><div><span className="eyebrow"><Lightbulb /> Coach</span><h3>Insights personnels</h3></div></header>
            <div className="insight-list">
              {stats?.insights.map((insight) => <span key={insight.title} className={`is-${insight.kind}`}><i>{insight.kind === 'focus' ? <Target /> : insight.kind === 'observation' ? <Activity /> : <Sparkles />}</i><span><strong>{insight.title}</strong><p>{insight.detail}</p></span></span>)}
              {!stats?.insights.length && <span className="is-empty"><i><Lightbulb /></i><span><strong>Pas encore de conclusion</strong><p>Nous attendons assez de pratique réelle avant de te conseiller.</p></span></span>}
            </div>
          </article>
        </div>

        <div className="skill-analysis">
          <div className="section-title compact"><div><span className="eyebrow">Compétences observées</span><h2>Ce que le microphone peut mesurer</h2></div><p>Le soufflet et la coordination ne sont pas notés tant qu’aucun capteur fiable ne permet de les distinguer.</p></div>
          <div className="skill-metric-grid">{skillCards.map(({ icon: Icon, label, value, suffix, progress, detail }) => <article key={label}><span><Icon /></span><small>{label}</small><StatValue value={value} suffix={suffix} /><p>{detail}</p><i><b style={{ width: `${progress}%` }} /></i></article>)}</div>
        </div>

        <div className="analytics-grid analytics-lower-grid">
          <article className="analytics-card trend-card">
            <header><div><span className="eyebrow"><TrendingUp /> 4 semaines</span><h3>Tendance de pratique</h3></div></header>
            <div className="trend-chart">{(stats?.trends ?? []).map((trend) => <span key={trend.weekStart}><i><b style={{ height: `${trend.activeSeconds ? Math.max(7, trend.activeSeconds / maxTrendSeconds * 100) : 0}%` }} /></i><small>{dateLabel(trend.weekStart, { day: 'numeric', month: 'short' })}</small><em>{formatDuration(trend.activeSeconds)}</em></span>)}</div>
            <footer>{stats?.trends.some((trend) => trend.pitchAccuracy !== null) ? 'La précision est calculée séparément à partir des notes entendues.' : 'La tendance apparaîtra après plusieurs semaines de pratique.'}</footer>
          </article>

          <article className="analytics-card repertoire-card">
            <header><div><span className="eyebrow">Répertoire</span><h3>Morceaux les plus travaillés</h3></div></header>
            <div>{stats?.favoriteSongs.map((favorite, index) => <span key={favorite.songId}><i>{index + 1}</i><strong>{favorite.title}</strong><small>{favorite.sessions} séance{favorite.sessions > 1 ? 's' : ''}</small><b>{formatDuration(favorite.activeSeconds)}</b></span>)}{!stats?.favoriteSongs.length && <p className="card-empty-copy">Aucun morceau pratiqué pour le moment.</p>}</div>
          </article>
        </div>

        <article className="analytics-card recent-card">
          <header><div><span className="eyebrow">Historique vérifiable</span><h3>Dernières séances</h3></div><small>Les démonstrations comptent dans le temps, jamais dans la précision.</small></header>
          <div className="recent-table" role="table">
            <div role="row" className="recent-table-head"><span>Date</span><span>Morceau</span><span>Mode</span><span>Temps actif</span><span>Précision</span><span>Avancement</span></div>
            {stats?.recentSessions.map((session) => <div role="row" key={session.id}><span>{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(session.endedAt))}</span><strong>{session.songTitle}</strong><span>{practiceModeLabel(session.mode)} · {HAND_LABELS[session.hand] ?? 'mélodie'}</span><span>{formatDuration(session.activeSeconds)}</span><span>{sessionAccuracy(session) === null ? 'Non évaluée' : `${sessionAccuracy(session)} %`}</span><span>{Math.round(session.completionPercent)} %</span></div>)}
            {!stats?.recentSessions.length && <div className="recent-empty">Aucune séance enregistrée. Ton historique commencera après ta première lecture active.</div>}
          </div>
        </article>
      </section>

      <section className="quote-strip"><BarChart3 /><blockquote>« Ce qui n’a pas encore été mesuré reste inconnu, jamais supposé. »<small>— Principe du suivi Soufflet</small></blockquote><span><CalendarDays /> Les conseils deviennent plus précis avec la régularité.</span></section>
    </main>
  );
}
