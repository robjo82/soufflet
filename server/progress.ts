export interface StoredPracticeSession {
  id: string;
  songId: string;
  songTitle: string;
  mode: string;
  hand: 'right' | 'left' | 'both';
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  correctCount: number;
  earlyCount: number;
  lateCount: number;
  wrongCount: number;
  completionPercent: number;
  tempoPercent: number;
  flagged: boolean;
}

const DAY_MS = 86_400_000;

export function inferSessionHand(mode: string, hand?: 'right' | 'left' | 'both') {
  if (hand) return hand;
  if (mode === 'left') return 'left' as const;
  if (mode === 'demo' || mode === 'combined') return 'both' as const;
  return 'right' as const;
}

function shiftedDate(value: string | Date, timezoneOffset: number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() - timezoneOffset * 60_000);
}

function dateKey(value: string | Date, timezoneOffset: number) {
  return shiftedDate(value, timezoneOffset).toISOString().slice(0, 10);
}

function moveDate(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  return moveDate(key, 1 - day);
}

function roundedPercent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round(numerator / denominator * 100) : null;
}

function sessionAccuracy(session: StoredPracticeSession) {
  const correctPitch = session.correctCount + session.earlyCount + session.lateCount;
  return { correctPitch, assessed: correctPitch + session.wrongCount };
}

export function summarizePractice(sessions: StoredPracticeSession[], timezoneOffset = 0, now = new Date()) {
  const safeOffset = Math.max(-840, Math.min(840, timezoneOffset));
  const usable = sessions.filter((session) => session.activeSeconds > 0);
  const today = dateKey(now, safeOffset);
  const currentMonday = mondayOf(today);
  const weekKeys = Array.from({ length: 7 }, (_, index) => moveDate(currentMonday, index));
  const byDate = new Map<string, StoredPracticeSession[]>();
  for (const session of usable) {
    const key = dateKey(session.endedAt, safeOffset);
    byDate.set(key, [...(byDate.get(key) ?? []), session]);
  }

  const week = weekKeys.map((date) => {
    const items = byDate.get(date) ?? [];
    return { date, activeSeconds: items.reduce((sum, item) => sum + item.activeSeconds, 0), sessions: items.length };
  });

  const trendStarts = Array.from({ length: 4 }, (_, index) => moveDate(currentMonday, (index - 3) * 7));
  const trends = trendStarts.map((weekStart) => {
    const keys = new Set(Array.from({ length: 7 }, (_, index) => moveDate(weekStart, index)));
    const items = usable.filter((session) => keys.has(dateKey(session.endedAt, safeOffset)));
    const accuracy = items.reduce((total, session) => {
      const current = sessionAccuracy(session);
      return { correct: total.correct + current.correctPitch, assessed: total.assessed + current.assessed };
    }, { correct: 0, assessed: 0 });
    return {
      weekStart,
      activeSeconds: items.reduce((sum, item) => sum + item.activeSeconds, 0),
      sessions: items.length,
      pitchAccuracy: roundedPercent(accuracy.correct, accuracy.assessed),
    };
  });

  const activeDates = [...byDate.keys()].sort();
  const activeDateSet = new Set(activeDates);
  let currentStreak = 0;
  let cursor = activeDateSet.has(today) ? today : moveDate(today, -1);
  while (activeDateSet.has(cursor)) {
    currentStreak += 1;
    cursor = moveDate(cursor, -1);
  }
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | undefined;
  for (const currentDate of activeDates) {
    runningStreak = previousDate && new Date(`${currentDate}T00:00:00Z`).getTime() - new Date(`${previousDate}T00:00:00Z`).getTime() === DAY_MS ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = currentDate;
  }

  const totals = usable.reduce((result, session) => {
    const accuracy = sessionAccuracy(session);
    result.activeSeconds += session.activeSeconds;
    result.correctPitch += accuracy.correctPitch;
    result.assessed += accuracy.assessed;
    result.onTime += session.correctCount;
    result.timedNotes += session.correctCount + session.earlyCount + session.lateCount;
    result.tempoTotal += session.tempoPercent;
    result.flagged += Number(session.flagged);
    return result;
  }, { activeSeconds: 0, correctPitch: 0, assessed: 0, onTime: 0, timedNotes: 0, tempoTotal: 0, flagged: 0 });

  const songs = new Map<string, { songId: string; title: string; activeSeconds: number; sessions: number }>();
  const modes = new Map<string, { mode: string; activeSeconds: number; sessions: number }>();
  for (const session of usable) {
    const song = songs.get(session.songId) ?? { songId: session.songId, title: session.songTitle, activeSeconds: 0, sessions: 0 };
    song.activeSeconds += session.activeSeconds;
    song.sessions += 1;
    songs.set(session.songId, song);
    const mode = modes.get(session.mode) ?? { mode: session.mode, activeSeconds: 0, sessions: 0 };
    mode.activeSeconds += session.activeSeconds;
    mode.sessions += 1;
    modes.set(session.mode, mode);
  }

  const pitchAccuracy = roundedPercent(totals.correctPitch, totals.assessed);
  const timingAccuracy = roundedPercent(totals.onTime, totals.timedNotes);
  const insights: Array<{ kind: 'encouragement' | 'focus' | 'observation'; title: string; detail: string }> = [];
  if (usable.length > 0 && totals.assessed === 0) insights.push({ kind: 'observation', title: 'Première mesure à venir', detail: 'Tes séances sont bien comptées. Utilise un mode avec microphone pour obtenir des analyses de précision.' });
  if (pitchAccuracy !== null && pitchAccuracy < 75) insights.push({ kind: 'focus', title: 'Consolide les hauteurs', detail: `${pitchAccuracy} % des notes évaluées ont la bonne hauteur. Le mode « attendre la bonne note » permet de travailler sans pression de tempo.` });
  if (pitchAccuracy !== null && pitchAccuracy >= 90) insights.push({ kind: 'encouragement', title: 'Hauteurs très solides', detail: `${pitchAccuracy} % de notes à la bonne hauteur : tu peux progressivement augmenter le tempo.` });
  if (timingAccuracy !== null && timingAccuracy < 70) insights.push({ kind: 'focus', title: 'Stabilise les attaques', detail: `${timingAccuracy} % des notes justes arrivent dans la fenêtre rythmique. Ralentis de 10 % et active le métronome.` });
  if (currentStreak >= 3) insights.push({ kind: 'encouragement', title: 'La régularité s’installe', detail: `${currentStreak} jours de pratique consécutifs. Une courte séance suffit pour entretenir cette série.` });
  if (totals.flagged > 0) insights.push({ kind: 'observation', title: 'Passages à reprendre', detail: `${totals.flagged} séance${totals.flagged > 1 ? 's contiennent' : ' contient'} un passage marqué difficile.` });
  if (usable.length > 0 && insights.length === 0) insights.push({ kind: 'encouragement', title: 'Un suivi fiable commence', detail: 'Continue quelques séances : les conseils deviendront plus précis à mesure que les notes évaluées s’accumulent.' });

  const last28Start = moveDate(today, -27);
  const activeDays28 = activeDates.filter((date) => date >= last28Start && date <= today).length;
  return {
    generatedAt: now.toISOString(),
    hasData: usable.length > 0,
    overview: {
      totalSeconds: totals.activeSeconds,
      weekSeconds: week.reduce((sum, day) => sum + day.activeSeconds, 0),
      totalSessions: usable.length,
      currentStreak,
      longestStreak,
      activeDays: activeDates.length,
      songsPracticed: songs.size,
      assessedNotes: totals.assessed,
      pitchAccuracy,
      timingAccuracy,
    },
    week,
    trends,
    skills: {
      notes: { value: pitchAccuracy, sampleSize: totals.assessed },
      rhythm: { value: timingAccuracy, sampleSize: totals.timedNotes },
      tempo: { value: usable.length ? Math.round(totals.tempoTotal / usable.length) : null, sampleSize: usable.length },
      regularity: { value: activeDays28, sampleSize: 28 },
    },
    recentSessions: [...usable].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 5),
    favoriteSongs: [...songs.values()].sort((a, b) => b.activeSeconds - a.activeSeconds).slice(0, 4),
    modeBreakdown: [...modes.values()].sort((a, b) => b.activeSeconds - a.activeSeconds),
    insights,
  };
}
