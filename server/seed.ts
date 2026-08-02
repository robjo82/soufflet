interface SeedButton {
  id: string; row: number; index: number; push: string; pull: string;
  pushMidi: number; pullMidi: number; finger?: number; role?: string; isGleichton?: boolean;
  pushChord?: string; pullChord?: string;
}

const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const note = (midi: number) => `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
const button = (id: string, row: number, index: number, pushMidi: number, pullMidi: number, extra: Partial<SeedButton> = {}): SeedButton => ({
  id, row, index, pushMidi, pullMidi, push: note(pushMidi), pull: note(pullMidi), role: 'melody', ...extra,
});
const row = (prefix: string, rowIndex: number, pairs: number[][]) => pairs.map(([push, pull], index) => button(`${prefix}-${index + 1}`, rowIndex, index + 1, push, pull, { finger: Math.min(5, Math.max(2, (index % 4) + 2)) }));
const basses = (roots: number[]) => roots.flatMap((root, pair) => [
  button(`bass-${pair + 1}`, 0, pair * 2 + 1, root, root + 7, { role: 'bass' }),
  button(`chord-${pair + 1}`, 0, pair * 2 + 2, root, root + 7, { role: 'chord' }),
]);
const clubLeftHand = () => [
  button('c1-chord-a-dm', 1, 1, 57, 62, { role: 'chord', pushChord: 'A', pullChord: 'Dm' }),
  button('c1-chord-c-g', 1, 2, 60, 55, { role: 'chord', pushChord: 'C', pullChord: 'G' }),
  button('c1-bass-a-d', 2, 3, 45, 50, { role: 'bass' }),
  button('c1-bass-c-g', 2, 4, 48, 43, { role: 'bass' }),
  button('c1-chord-eb-bb', 3, 5, 63, 58, { role: 'chord', pushChord: 'Eb', pullChord: 'Bb' }),
  button('c1-chord-f-c', 3, 6, 53, 60, { role: 'chord', pushChord: 'F', pullChord: 'C' }),
  button('c1-bass-eb-bb', 4, 7, 51, 46, { role: 'bass' }),
  button('c1-bass-f-c', 4, 8, 41, 48, { role: 'bass' }),
];

const gcOuter = [[55, 57], [59, 60], [62, 64], [67, 66], [71, 69], [74, 72], [79, 76], [83, 78], [86, 81], [91, 84]];
const gcInner = [[48, 54], [52, 55], [55, 59], [60, 62], [64, 65], [67, 69], [72, 71], [76, 74], [79, 77], [84, 81], [88, 83]];
// Variante mesurée sur le Club I 10+9+2 du projet. La première rangée suit Do
// à partir du bouton 2 et la deuxième suit Fa, avec Do5 comme Gleichton.
const clubOuter = [[78, 80], [55, 59], [60, 62], [64, 65], [67, 69], [72, 71], [76, 74], [79, 77], [84, 81], [88, 83]];
const clubInner = [[57, 60], [60, 64], [65, 67], [69, 70], [72, 72], [77, 76], [81, 79], [84, 82], [89, 86]];

export const ACCORDION_SEEDS = [
  {
    id: 'hohner-club-i-cf-10-9-2', maker: 'Hohner', model: 'Club I — 10 + 9 + 2', tuning: 'Do/Fa (C/F), Gleichton', color: '#6e2f28', rightRows: [10, 9, 2], bassCount: 8,
    description: 'Variante Club I mesurée : clavier Do/Fa, Gleichton Do5, main gauche Club complète et diapason historique.',
    buttons: [...row('c1-out', 1, clubOuter), ...row('c1-in', 2, clubInner).map((item) => item.index === 5 ? { ...item, isGleichton: true } : item), button('c1-help-1', 3, 1, 66, 68, { role: 'accidental', finger: 2 }), button('c1-help-2', 3, 2, 75, 73, { role: 'accidental', finger: 3 })],
    basses: clubLeftHand(), verified: false,
    sourceNote: 'Main droite mesurée le 19/07/2026. Main gauche mesurée le 02/08/2026 : A/Dm, C/G, basses A/D et C/G, Eb/Bb, F/C, basses Eb/Bb et F/C. Diapason acoustique estimé à A4 ≈ 435 Hz.',
    referencePitchHz: 435,
  },
  {
    id: 'standard-gc-21-8', maker: 'Standard', model: '2 rangs — 21 + 8', tuning: 'Sol/Do (G/C)', color: '#315c4b', rightRows: [10, 11], bassCount: 8,
    description: 'Le clavier le plus courant en France, idéal pour débuter.', buttons: [...row('gc-out', 1, gcOuter), ...row('gc-in', 2, gcInner)], basses: basses([43, 48, 50, 55]), verified: true,
  },
  {
    id: 'standard-dg-21-8', maker: 'Standard', model: '2 rangs — 21 + 8', tuning: 'Ré/Sol (D/G)', color: '#35556b', rightRows: [10, 11], bassCount: 8,
    description: 'Accordage fréquent dans les répertoires anglais et irlandais.', buttons: [...row('dg-out', 1, gcOuter.map(([a, b]) => [a + 7, b + 7])), ...row('dg-in', 2, gcInner.map(([a, b]) => [a + 7, b + 7]))], basses: basses([50, 55, 57, 62]), verified: true,
  },
];
