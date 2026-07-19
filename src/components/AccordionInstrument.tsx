import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Direction } from '../types';
import { useSynth } from '../hooks/useSynth';
import { AccordionView, type AccordionViewProps } from './AccordionView';
import { getAccordionVisualVariant } from './accordionLayout';
import { getAccordionInstrumentState, resolveAccordionButtonDirection } from './accordionInstrumentState';
import { Accordion3DErrorBoundary } from './accordion3d/Accordion3DErrorBoundary';
import { supportsAccordion3D } from './accordion3d/accordion3dSupport';

const LazyAccordion3D = lazy(() => import('./accordion3d/Accordion3D').then((module) => ({ default: module.Accordion3D })));

export type AccordionInstrumentContext = 'lesson' | 'onboarding' | 'tutorial' | 'practice' | 'studio' | 'tuner' | 'settings';

interface AccordionInstrumentProps extends AccordionViewProps {
  context?: AccordionInstrumentContext;
  showLearningGuides?: boolean;
}

export function AccordionInstrument({
  config,
  activeEvent,
  direction = 'push',
  notation,
  detectedMidi,
  selectedButtonId,
  compact = false,
  depressActive = false,
  bellowsAmount,
  airValveActive = false,
  onButtonPress,
  context = 'practice',
  showLearningGuides = true,
}: AccordionInstrumentProps) {
  const { playMidi } = useSynth();
  const [pointerPressedButtonId, setPointerPressedButtonId] = useState<string>();
  const releaseTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);
  const fallback = (
    <AccordionView
      config={config}
      activeEvent={activeEvent}
      direction={direction}
      notation={notation}
      detectedMidi={detectedMidi}
      selectedButtonId={selectedButtonId}
      compact={compact}
      depressActive={depressActive}
      bellowsAmount={bellowsAmount}
      airValveActive={airValveActive}
      onButtonPress={onButtonPress}
    />
  );
  const useThreeDimensions = getAccordionVisualVariant(config) === 'club-i' && supportsAccordion3D();
  if (!useThreeDimensions) return fallback;

  const state = getAccordionInstrumentState(config, { activeEvent, detectedMidi, selectedButtonId, depressActive });
  const amount = Math.max(0, Math.min(1, bellowsAmount ?? (direction === 'pull' ? .58 : .34)));
  const allButtons = [...config.buttons, ...config.basses];
  const pressButton = (buttonId: string) => {
    const button = allButtons.find((candidate) => candidate.id === buttonId);
    if (!button) return;
    const pressedDirection: Direction = config.buttons.includes(button)
      ? resolveAccordionButtonDirection(button, direction, detectedMidi)
      : direction;
    playMidi(pressedDirection === 'push' ? button.pushMidi : button.pullMidi, .5, button.role === 'bass' || button.role === 'chord' ? .09 : undefined);
    onButtonPress?.(buttonId, pressedDirection);
    window.clearTimeout(releaseTimer.current);
    setPointerPressedButtonId(buttonId);
    releaseTimer.current = window.setTimeout(() => setPointerPressedButtonId(undefined), 150);
  };
  const pressedButtonIds = pointerPressedButtonId
    ? Array.from(new Set([...state.pressedButtonIds, pointerPressedButtonId]))
    : state.pressedButtonIds;

  return (
    <div className={`accordion-instrument is-3d accordion-instrument-${context}`} data-accordion-renderer="3d">
      <Accordion3DErrorBoundary fallback={fallback}>
        <>
          <Suspense fallback={<div className="accordion-instrument-loading" role="status">Préparation de ton accordéon…</div>}>
            <LazyAccordion3D
              bellowsAmount={amount}
              direction={direction}
              highlightedButtonIds={state.highlightedButtonIds}
              pressedButtonIds={pressedButtonIds}
              detectedButtonIds={state.detectedButtonIds}
              selectedButtonIds={state.selectedButtonIds}
              airValveActive={airValveActive}
              showLearningGuides={showLearningGuides}
              onButtonPress={pressButton}
              framing={context === 'tuner' ? 'compact' : 'standard'}
            />
          </Suspense>
          <div className="accordion-3d-accessible-controls" aria-label="Boutons de l’accordéon">
            <strong>Clavier de l’accordéon</strong>
            <span>Utilise Tab, puis Entrée ou Espace pour écouter une touche.</span>
            <div>
              {allButtons.map((button) => (
                <button
                  type="button"
                  key={button.id}
                  aria-pressed={pressedButtonIds.includes(button.id)}
                  onClick={() => pressButton(button.id)}
                  title={`Pousser : ${button.push} · Tirer : ${button.pull}`}
                >
                  {button.role === 'bass' ? 'Basse' : button.role === 'chord' ? 'Accord' : 'Bouton'} {button.index}
                </button>
              ))}
            </div>
          </div>
        </>
      </Accordion3DErrorBoundary>
    </div>
  );
}
