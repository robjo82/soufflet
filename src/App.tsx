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
import { AccountPage } from './components/AccountPage';
import { adaptSongToAccordion, DEMO_SONG, FALLBACK_ACCORDIONS, SKILLS } from './data';
import { isAndroidOnboardingPreview, isAndroidPreview, setNativePracticeMode } from './nativeApp';
import type { AccordionConfig, Notation, Page, PracticeSessionInput, PracticeStats, Song, UserAccount } from './types';

interface UserPreferences {
  accordionId: string;
  notation: Notation;
  countIn: boolean;
  onboardingDone: boolean;
  tutorialDone: boolean;
}

type PortablePreferences = Pick<UserPreferences, 'accordionId' | 'notation' | 'countIn'>;

const defaultPreferences: UserPreferences = {
  accordionId: 'standard-gc-21-8',
  notation: 'french',
  countIn: true,
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
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const stored = { ...defaultPreferences, ...getStored('soufflet.preferences', defaultPreferences) };
    if (isAndroidOnboardingPreview()) return { ...stored, onboardingDone: false, tutorialDone: false };
    return isAndroidPreview() ? { ...stored, onboardingDone: true, tutorialDone: true } : stored;
  });
  const [songs, setSongs] = useState<Song[]>(() => getStored<Song[]>('soufflet.songs', []).filter((song) => !song.builtIn));
  const [practiceSong, setPracticeSong] = useState<Song | null>(null);
  const [studioSong, setStudioSong] = useState<Song | undefined>();
  const [showImport, setShowImport] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('soufflet.geminiKey') ?? '');
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);

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
    fetch('/api/preferences', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { preferences: (PortablePreferences & { updatedAt: string }) | null };
      if (payload.preferences) {
        setPreferences((current) => {
          const synced = { ...current, accordionId: payload.preferences!.accordionId, notation: payload.preferences!.notation, countIn: payload.preferences!.countIn };
          localStorage.setItem('soufflet.preferences', JSON.stringify(synced));
          return synced;
        });
      } else {
        const local = { ...defaultPreferences, ...getStored('soufflet.preferences', defaultPreferences) };
        await fetch('/api/preferences', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ accordionId: local.accordionId, notation: local.notation, countIn: local.countIn }),
        });
      }
    }).catch(() => undefined);
    fetch(`/api/progress?timezoneOffset=${new Date().getTimezoneOffset()}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { stats: PracticeStats };
      setPracticeStats(payload.stats);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [user]);

  const savePreferences = useCallback((next: UserPreferences) => {
    setPreferences(next);
    localStorage.setItem('soufflet.preferences', JSON.stringify(next));
    if (user) {
      void fetch('/api/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accordionId: next.accordionId, notation: next.notation, countIn: next.countIn }),
      });
    }
  }, [user]);

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

  const recordPracticeSession = useCallback(async (session: PracticeSessionInput) => {
    const response = await fetch(`/api/practice-sessions?timezoneOffset=${new Date().getTimezoneOffset()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
      keepalive: true,
    });
    if (!response.ok) return;
    const payload = await response.json() as { stats: PracticeStats };
    setPracticeStats(payload.stats);
  }, []);

  const navigate = useCallback((next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const logout = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST' });
    setUser(null); setPracticeSong(null); setPracticeStats(null);
  }, []);

  const accountDeleted = useCallback(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('soufflet.')) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('soufflet.')) sessionStorage.removeItem(key);
    setUser(null); setPracticeSong(null); setPracticeStats(null); setSongs([]); setAccordions(FALLBACK_ACCORDIONS);
    setPreferences(defaultPreferences); setPage('home');
  }, []);

  useEffect(() => {
    void setNativePracticeMode(Boolean(practiceSong));
    return () => { void setNativePracticeMode(false); };
  }, [practiceSong]);

  useEffect(() => {
    const onNativeBack = (event: Event) => {
      if (showImport) { event.preventDefault(); setShowImport(false); return; }
      if (practiceSong) { event.preventDefault(); setPracticeSong(null); return; }
      if (page !== 'home') { event.preventDefault(); navigate('home'); }
    };
    document.addEventListener('soufflet:native-back', onNativeBack);
    return () => document.removeEventListener('soufflet:native-back', onNativeBack);
  }, [navigate, page, practiceSong, showImport]);

  if (authLoading) return <div className="app-loading"><span className="brand-mark"><i /><i /><i /></span><strong>soufflet</strong><small>Préparation de ton espace…</small></div>;
  if (!user) return <AuthPage onAuthenticated={setUser} />;
  if (!selectedAccordion) return null;

  if (!preferences.onboardingDone) {
    return <Onboarding accordions={accordions} initialAccordionId={preferences.accordionId} initialNotation={preferences.notation} onSkip={(accordionId, notation) => savePreferences({ ...preferences, accordionId, notation, onboardingDone: true, tutorialDone: false })} onComplete={(accordionId, notation) => {
      savePreferences({ ...preferences, accordionId, notation, onboardingDone: true, tutorialDone: false });
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
    return <PracticePlayer song={practiceSong} accordion={selectedAccordion} notation={preferences.notation} countIn={preferences.countIn} onNotationChange={(notation) => savePreferences({ ...preferences, notation })} onSessionUpdate={recordPracticeSession} onClose={() => setPracticeSong(null)} />;
  }

  return (
    <AppShell page={page} onNavigate={navigate} user={user} practiceStats={practiceStats} onLogout={logout}>
      {page === 'home' && <HomePage accordion={selectedAccordion} song={songs.find((song) => song.status === 'ready') ?? DEMO_SONG} stats={practiceStats} onPractice={startPractice} onNavigateLearn={() => navigate('learn')} displayName={user.displayName} />}
      {page === 'learn' && <LearnPage skills={SKILLS} song={DEMO_SONG} onPractice={startPractice} />}
      {page === 'library' && <LibraryPage songs={songs} onImport={() => setShowImport(true)} onPractice={startPractice} onEdit={(song) => { setStudioSong(song); navigate('studio'); }} />}
      {page === 'studio' && <StudioPage songs={songs} initialSong={studioSong} accordion={selectedAccordion} onSave={saveSong} onPractice={startPractice} />}
      {page === 'tuner' && <TunerPage accordion={selectedAccordion} notation={preferences.notation} onBack={() => navigate('home')} onAccordionChange={(updated) => { setAccordions((items) => items.some((item) => item.id === updated.id) ? items.map((item) => item.id === updated.id ? updated : item) : [...items, updated]); savePreferences({ ...preferences, accordionId: updated.id }); }} />}
      {page === 'settings' && <SettingsPage accordions={accordions} selectedId={preferences.accordionId} notation={preferences.notation} countIn={preferences.countIn} apiKey={apiKey} onSave={(accordionId, notation, countIn, nextKey) => {
        savePreferences({ ...preferences, accordionId, notation, countIn });
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
      {page === 'account' && <AccountPage user={user} accordions={accordions} selectedAccordionId={preferences.accordionId} onUserUpdated={setUser} onOpenSettings={() => navigate('settings')} onLogout={logout} onAccountDeleted={accountDeleted} />}
      {showImport && <ImportModal accordion={selectedAccordion} apiKey={apiKey} onClose={() => setShowImport(false)} onImported={(song) => { saveSong(song); if (song.events.length) { setStudioSong(song); navigate('studio'); } }} />}
    </AppShell>
  );
}
