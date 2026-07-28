import { useState } from 'react';
import { CircleHelp, Hand } from 'lucide-react';
import type { AccordionConfig, SongEvent } from '../types';
import {
  fingerName, fingerSymbol, getFingeringMoment, MELODY_FINGERS,
} from '../fingeringGuide';

interface FingeringGuideProps {
  events: SongEvent[];
  activeIndex: number;
  accordion: AccordionConfig;
  connectsToScore: boolean;
}

export function FingeringGuide({
  events,
  activeIndex,
  accordion,
  connectsToScore,
}: FingeringGuideProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const moment = getFingeringMoment(events, activeIndex, accordion);
  if (!moment) return null;
  const nextFinger = moment.next[0]?.finger;
  const rowName = moment.current.row === 1 ? 'extérieure' : moment.current.row === 2 ? 'intérieure' : 'auxiliaire';

  return (
    <section className={`fingering-guide ${connectsToScore ? 'connects-to-score' : ''}`} aria-label="Conseil de doigté pour la main droite">
      <div className="fingering-current">
        <span><Hand aria-hidden="true" /></span>
        <div>
          <small>DOIGTÉ · MAIN DROITE</small>
          <strong><b>{moment.current.symbol}</b> {moment.current.name}</strong>
          <em>Bouton {moment.current.button} · rangée {rowName}</em>
        </div>
      </div>
      <div className="fingering-hand" aria-label={`Doigt conseillé : ${moment.current.name.toLowerCase()}`}>
        {MELODY_FINGERS.map((finger) => (
          <span
            key={finger}
            className={`${finger === moment.current.finger ? 'is-current' : ''} ${finger === nextFinger ? 'is-next' : ''}`}
            title={fingerName(finger)}
          >
            <i>{fingerSymbol(finger)}</i>
            <small>{fingerName(finger)}</small>
          </span>
        ))}
      </div>
      <div className="fingering-instruction">
        <strong>{moment.advice}</strong>
        <span>
          {moment.next.length
            ? <>Ensuite&nbsp;: {moment.next.map((item, index) => <b key={`${item.button}-${index}`}>{item.symbol} · bouton {item.button}{index < moment.next.length - 1 ? '  →  ' : ''}</b>)}</>
            : 'Dernière note de la phrase.'}
        </span>
      </div>
      <button
        type="button"
        className="fingering-help"
        aria-label="Comprendre cette proposition de doigté"
        aria-expanded={explanationOpen}
        onClick={() => setExplanationOpen((value) => !value)}
      >
        <CircleHelp />
      </button>
      {explanationOpen && (
        <div className="fingering-explanation" role="note">
          <strong>I · M · A · O</strong>
          <p>Index, majeur, annulaire, auriculaire. Le pouce reste posé sans force contre le bord du clavier.</p>
          <p>Cette proposition analyse toute la phrase pour limiter les déplacements. Adapte-la si ta morphologie ou ton professeur te conseille autrement.</p>
        </div>
      )}
    </section>
  );
}
