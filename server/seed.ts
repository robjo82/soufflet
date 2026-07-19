interface SeedButton {
  id: string; row: number; index: number; push: string; pull: string;
  pushMidi: number; pullMidi: number; finger?: number; role?: string; isGleichton?: boolean;
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

const gcOuter = [[55, 57], [59, 60], [62, 64], [67, 66], [71, 69], [74, 72], [79, 76], [83, 78], [86, 81], [91, 84]];
const gcInner = [[48, 54], [52, 55], [55, 59], [60, 62], [64, 65], [67, 69], [72, 71], [76, 74], [79, 77], [84, 81], [88, 83]];
// Variante mesurée sur le Club I 10+9+2 du projet. La première rangée suit Do
// à partir du bouton 2 et la deuxième suit Fa, avec Do5 comme Gleichton.
const clubOuter = [[78, 80], [55, 59], [60, 62], [64, 65], [67, 69], [72, 71], [76, 74], [79, 77], [84, 81], [88, 83]];
const clubInner = [[57, 60], [60, 64], [65, 67], [69, 70], [72, 72], [77, 76], [81, 79], [84, 82], [89, 86]];

export const ACCORDION_SEEDS = [
  {
    id: 'hohner-club-i-cf-10-9-2', maker: 'Hohner', model: 'Club I — 10 + 9 + 2', tuning: 'Do/Fa (C/F), Gleichton', color: '#6e2f28', rightRows: [10, 9, 2], bassCount: 8,
    description: 'Variante Club I mesurée : rangée de Do, rangée de Fa avec Gleichton Do5 et deux altérations.',
    buttons: [...row('c1-out', 1, clubOuter), ...row('c1-in', 2, clubInner).map((item) => item.index === 5 ? { ...item, isGleichton: true } : item), button('c1-help-1', 3, 1, 66, 68, { role: 'accidental', finger: 2 }), button('c1-help-2', 3, 2, 75, 73, { role: 'accidental', finger: 3 })],
    basses: basses([36, 41, 43, 48]), verified: false, sourceNote: 'Variante mesurée le 19/07/2026 : P1 = F♯5/G♯5, rang Do dès G3/B3, rang Fa dès F4/G4 et Gleichton Do5 au bouton 5. Les autres Club I peuvent différer.',
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
