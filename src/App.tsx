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
import { FirstLessonTutorial } from './components/FirstLessonTutorial';
import { ImportModal } from './components/ImportModal';
import { AuthPage } from './components/AuthPage';
import { adaptSongToAccordion, DEMO_SONG, FALLBACK_ACCORDIONS, SKILLS } from './data';
import type { AccordionConfig, Notation, Page, Song, UserAccount } from './types';

interface UserPreferences {
  accordionId: string;
  notation: Notation;
  onboardingDone: boolean;
  tutorialDone: boolean;
}

const defaultPreferences: UserPreferences = {
  accordionId: 'standard-gc-21-8',
  notation: 'french',
  onboardingDone: false,
  tutorialDone: false,
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [accordions, setAccordions] = useState<AccordionConfig[]>(FALLBACK_ACCORDIONS);
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({ ...defaultPreferences, ...getStored('soufflet.preferences', defaultPreferences) }));
  const [songs, setSongs] = useState<Song[]>(() => getStored<Song[]>('soufflet.songs', []).filter((song) => !song.builtIn));
  const [practiceSong, setPracticeSong] = useState<Song | null>(null);
  const [studioSong, setStudioSong] = useState<Song | undefined>();
  const [showImport, setShowImport] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('soufflet.geminiKey') ?? '');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/auth/me', { signal: controller.signal }).then(async (response) => response.ok ? (await response.json() as { user: UserAccount | null }).user : null),
      fetch('/api/accordions', { signal: controller.signal }).then(async (response) => response.ok ? (await response.json() as { accordions: AccordionConfig[] }).accordions : []),
    ]).then(([account, configs]) => { setUser(account); if (configs.length) setAccordions(configs); }).catch(() => undefined).finally(() => setAuthLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => { localStorage.setItem('soufflet.songs', JSON.stringify(songs.filter((song) => !song.builtIn))); }, [songs]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch('/api/library', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { songs: Song[] };
      setSongs((current) => [...payload.songs, ...current.filter((song) => !song.builtIn)]);
    }).catch(() => undefined);
    fetch('/api/accordions', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { accordions: AccordionConfig[] };
      if (payload.accordions.length) setAccordions(payload.accordions);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [user]);

  const savePreferences = useCallback((next: UserPreferences) => {
    setPreferences(next);
    localStorage.setItem('soufflet.preferences', JSON.stringify(next));
  }, []);

  const selectedAccordion = useMemo(() => accordions.find((item) => item.id === preferences.accordionId) ?? accordions[0], [accordions, preferences.accordionId]);
  const firstLessonSong = useMemo(() => selectedAccordion ? adaptSongToAccordion(DEMO_SONG, selectedAccordion) : DEMO_SONG, [selectedAccordion]);

  const saveSong = useCallback((next: Song) => {
    setSongs((items) => items.some((item) => item.id === next.id) ? items.map((item) => item.id === next.id ? next : item) : [next, ...items]);
  }, []);

  const startPractice = useCallback((song: Song) => {
    if (selectedAccordion) {
      window.scrollTo({ top: 0 });
      setPracticeSong(adaptSongToAccordion(song, selectedAccordion));
    }
  }, [selectedAccordion]);

  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading) return <div className="app-loading"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong><small>Préparation de ton espace…</small></div>;
  if (!user) return <AuthPage onAuthenticated={setUser} />;
  if (!selectedAccordion) return null;

  if (!preferences.onboardingDone) {
    return <Onboarding accordions={accordions} initialAccordionId={preferences.accordionId} initialNotation={preferences.notation} onSkip={(accordionId, notation) => savePreferences({ accordionId, notation, onboardingDone: true, tutorialDone: false })} onComplete={(accordionId, notation) => {
      savePreferences({ accordionId, notation, onboardingDone: true, tutorialDone: false });
    }} />;
  }

  if (!preferences.tutorialDone) {
    return <FirstLessonTutorial accordion={selectedAccordion} notation={preferences.notation} song={firstLessonSong} onNotationChange={(notation) => savePreferences({ ...preferences, notation })} onComplete={() => {
      savePreferences({ ...preferences, tutorialDone: true });
      setPracticeSong(null);
      setPage('home');
      window.scrollTo({ top: 0 });
    }} />;
  }

  if (practiceSong) {
    return <PracticePlayer song={practiceSong} accordion={selectedAccordion} notation={preferences.notation} onNotationChange={(notation) => savePreferences({ ...preferences, notation })} onClose={() => setPracticeSong(null)} />;
  }

  return (
    <AppShell page={page} onNavigate={navigate} user={user} onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }); setUser(null); setPracticeSong(null); }}>
      {page === 'home' && <HomePage accordion={selectedAccordion} song={songs.find((song) => song.status === 'ready') ?? DEMO_SONG} onPractice={startPractice} onNavigateLearn={() => navigate('learn')} displayName={user.displayName} />}
      {page === 'learn' && <LearnPage skills={SKILLS} song={DEMO_SONG} onPractice={startPractice} />}
      {page === 'library' && <LibraryPage songs={songs} onImport={() => setShowImport(true)} onPractice={startPractice} onEdit={(song) => { setStudioSong(song); navigate('studio'); }} />}
      {page === 'studio' && <StudioPage songs={songs} initialSong={studioSong} accordion={selectedAccordion} onSave={saveSong} onPractice={startPractice} />}
      {page === 'tuner' && <TunerPage accordion={selectedAccordion} notation={preferences.notation} onBack={() => navigate('home')} onAccordionChange={(updated) => { setAccordions((items) => items.some((item) => item.id === updated.id) ? items.map((item) => item.id === updated.id ? updated : item) : [...items, updated]); savePreferences({ ...preferences, accordionId: updated.id }); }} />}
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
