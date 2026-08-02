import { noteFromMidi } from './data';
import type { AccordionConfig, LeftHandAcousticProfile, TunerReading } from './types';

export interface TunerExportReport {
  schemaVersion: 2;
  exportedAt: string;
  instrument: AccordionConfig;
  readings: Array<TunerReading & { expectedNote: string; detectedNote: string }>;
  leftHandProfile: LeftHandAcousticProfile | null;
  diagnosticNote: string;
}

export function buildTunerExport(
  accordion: AccordionConfig,
  readings: TunerReading[],
  leftHandProfile: LeftHandAcousticProfile | null = null,
  exportedAt = new Date().toISOString(),
): TunerExportReport {
  return {
    schemaVersion: 2,
    exportedAt,
    instrument: structuredClone(accordion),
    readings: readings.map((reading) => ({
      ...reading,
      expectedNote: noteFromMidi(reading.expectedMidi),
      detectedNote: noteFromMidi(reading.detectedMidi),
    })),
    leftHandProfile: leftHandProfile ? structuredClone(leftHandProfile) : null,
    diagnosticNote: readings.length
      ? 'Les cents permettent d’évaluer l’accordage fin des notes isolées. Le profil main gauche décrit des basses et accords sans mesurer séparément leurs anches.'
      : leftHandProfile
        ? 'Le profil main gauche décrit des basses et accords sans mesurer séparément leurs anches. Aucun relevé monophonique fin n’était archivé.'
        : 'Aucun relevé fin n’était archivé pour cette campagne. La cartographie complète de l’instrument reste incluse.',
  };
}

export function tunerExportFilename(accordion: AccordionConfig, date = new Date()) {
  const instrument = `${accordion.maker}-${accordion.model}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `soufflet-accordeur-${instrument}-${date.toISOString().slice(0, 10)}.json`;
}
