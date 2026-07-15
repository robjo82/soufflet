import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { HomePage } from './components/HomePage';
import { LearnPage } from './components/LearnPage';
import { LibraryPage } from './components/LibraryPage';
import { StudioPage } from './components/StudioPage';
import { TunerPage } from './components/TunerPage';
import { SettingsPage } from './components/SettingsPage';
import { PracticePlayer } from './components/PracticePlayer';
import { Onboarding } from './components/Onboarding';
import { ImportModal } from './components/ImportModal';
import { DEMO_SONG, FALLBACK_ACCORDIONS, SKILLS } from './data';
import type { AccordionConfig, Notation, Page, Song } from './types';

interface UserPreferences {
  accordionId: string;
  notation: Notation;
  onboardingDone: boolean;
}

const defaultPreferences: UserPreferences = {
  accordionId: 'standard-gc-21-8',
  notation: 'french',
  onboardingDone: false,
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [accordions, setAccordions] = useState<AccordionConfig[]>(FALLBACK_ACCORDIONS);
  const [preferences, setPreferences] = useState<UserPreferences>(() => getStored('soufflet.preferences', defaultPreferences));
  const [songs, setSongs] = useState<Song[]>(() => getStored('soufflet.songs', [DEMO_SONG]));
  const [practiceSong, setPracticeSong] = useState<Song | null>(null);
  const [studioSong, setStudioSong] = useState<Song | undefined>();
  const [showImport, setShowImport] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('soufflet.geminiKey') ?? '');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/accordions', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API indisponible')))
      .then((data: { accordions: AccordionConfig[] }) => data.accordions?.length && setAccordions(data.accordions))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => { localStorage.setItem('soufflet.songs', JSON.stringify(songs)); }, [songs]);

  const savePreferences = useCallback((next: UserPreferences) => {
    setPreferences(next);
    localStorage.setItem('soufflet.preferences', JSON.stringify(next));
  }, []);

  const selectedAccordion = useMemo(() => accordions.find((item) => item.id === preferences.accordionId) ?? accordions[0], [accordions, preferences.accordionId]);

  const saveSong = useCallback((next: Song) => {
    setSongs((items) => items.some((item) => item.id === next.id) ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
  }, []);

  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!selectedAccordion) return null;

  if (!preferences.onboardingDone) {
    return <Onboarding accordions={accordions} initialAccordionId={preferences.accordionId} initialNotation={preferences.notation} onSkip={() => savePreferences({ ...preferences, onboardingDone: true })} onComplete={(accordionId, notation) => {
      savePreferences({ accordionId, notation, onboardingDone: true });
      setPracticeSong(DEMO_SONG);
    }} />;
  }

  if (practiceSong) {
    return <PracticePlayer song={practiceSong} accordion={selectedAccordion} notation={preferences.notation} onNotationChange={(notation) => savePreferences({ ...preferences, notation })} onClose={() => setPracticeSong(null)} />;
  }

  return (
    <AppShell page={page} onNavigate={navigate}>
      {page === 'home' && <HomePage accordion={selectedAccordion} song={songs[0] ?? DEMO_SONG} onPractice={setPracticeSong} onNavigateLearn={() => navigate('learn')} />}
      {page === 'learn' && <LearnPage skills={SKILLS} song={DEMO_SONG} onPractice={setPracticeSong} />}
      {page === 'library' && <LibraryPage songs={songs} onImport={() => setShowImport(true)} onPractice={setPracticeSong} onEdit={(song) => { setStudioSong(song); navigate('studio'); }} />}
      {page === 'studio' && <StudioPage songs={songs} initialSong={studioSong} accordion={selectedAccordion} onSave={saveSong} onPractice={setPracticeSong} />}
      {page === 'tuner' && <TunerPage accordion={selectedAccordion} notation={preferences.notation} onBack={() => navigate('home')} />}
      {page === 'settings' && <SettingsPage accordions={accordions} selectedId={preferences.accordionId} notation={preferences.notation} apiKey={apiKey} onSave={(accordionId, notation, nextKey) => {
        savePreferences({ ...preferences, accordionId, notation });
        setApiKey(nextKey);
        if (nextKey) sessionStorage.setItem('soufflet.geminiKey', nextKey); else sessionStorage.removeItem('soufflet.geminiKey');
      }} onCreateAccordion={async (accordion) => {
        const response = await fetch('/api/accordions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accordion) });
        const payload = await response.json() as { accordion?: AccordionConfig; error?: string };
        if (!response.ok || !payload.accordion) throw new Error(payload.error ?? 'Configuration impossible à enregistrer.');
        setAccordions((items) => [...items, payload.accordion!]);
        savePreferences({ ...preferences, accordionId: payload.accordion.id });
        return payload.accordion;
      }} />}
      {showImport && <ImportModal accordion={selectedAccordion} apiKey={apiKey} onClose={() => setShowImport(false)} onImported={(song) => { saveSong(song); if (song.events.length) { setStudioSong(song); navigate('studio'); } }} />}
    </AppShell>
  );
}
