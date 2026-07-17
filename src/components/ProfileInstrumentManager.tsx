import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Music2, Pencil, Piano, Plus, Save, Trash2, X } from 'lucide-react';
import type { AccordionConfig, PianoConfig, PianoInput, PianoKeyboardSize } from '../types';

interface Props {
  accordions: AccordionConfig[];
  pianos: PianoConfig[];
  selectedAccordionId: string;
  onSaveAccordion: (accordion: AccordionConfig) => Promise<AccordionConfig>;
  onDeleteAccordion: (id: string) => Promise<void>;
  onSavePiano: (piano: PianoConfig) => Promise<PianoConfig>;
  onDeletePiano: (id: string) => Promise<void>;
}

type Editor = { kind: 'choice' } | { kind: 'accordion'; value: AccordionConfig } | { kind: 'piano'; value: PianoConfig } | null;
const pianoInputs: Array<[PianoInput, string]> = [['midi', 'MIDI'], ['microphone', 'Microphone'], ['computer-keyboard', 'Clavier d’ordinateur']];

export function ProfileInstrumentManager({ accordions, pianos, selectedAccordionId, onSaveAccordion, onDeleteAccordion, onSavePiano, onDeletePiano }: Props) {
  const personalAccordions = useMemo(() => accordions.filter((item) => item.id.startsWith('custom-')), [accordions]);
  const templates = useMemo(() => accordions.filter((item) => !item.id.startsWith('custom-')), [accordions]);
  const total = personalAccordions.length + pianos.length;
  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const newAccordion = () => {
    const base = templates.find((item) => item.id === selectedAccordionId) ?? templates[0];
    if (base) setEditor({ kind: 'accordion', value: { ...structuredClone(base), id: 'draft', maker: 'Mon accordéon', model: base.model, verified: false } });
  };
  const newPiano = () => setEditor({ kind: 'piano', value: { id: 'draft', name: 'Mon piano', keyboardSize: 49, input: 'computer-keyboard', notation: 'french' } });
  const save = async () => {
    if (!editor || editor.kind === 'choice') return;
    setSaving(true); setError('');
    try { if (editor.kind === 'accordion') await onSaveAccordion(editor.value); else await onSavePiano(editor.value); setEditor(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  return <section className="account-card equipment-card"><header><span><Music2 /></span><div><h2>Mon matériel</h2><p>Ajoute, modifie ou retire jusqu’à cinq instruments au total.</p></div></header>
    <div className="equipment-list mixed-equipment-list">
      {personalAccordions.map((accordion) => <article key={accordion.id}><span className="equipment-icon accordion-equipment"><Music2 /></span><div><small>Accordéon</small><strong>{accordion.maker}</strong><span>{accordion.model} · {accordion.tuning}</span></div><div className="equipment-actions"><button type="button" aria-label={`Modifier ${accordion.maker}`} onClick={() => setEditor({ kind: 'accordion', value: structuredClone(accordion) })}><Pencil /></button><button type="button" className="is-danger" aria-label={`Supprimer ${accordion.maker}`} onClick={() => void onDeleteAccordion(accordion.id)}><Trash2 /></button></div></article>)}
      {pianos.map((piano) => <article key={piano.id}><span className="equipment-icon piano-equipment"><Piano /></span><div><small>Piano</small><strong>{piano.name}</strong><span>{piano.keyboardSize} touches · {pianoInputs.find(([id]) => id === piano.input)?.[1]} · {piano.notation === 'french' ? 'Do Ré Mi' : 'C D E'}</span></div><div className="equipment-actions"><button type="button" aria-label={`Modifier ${piano.name}`} onClick={() => setEditor({ kind: 'piano', value: { ...piano } })}><Pencil /></button><button type="button" className="is-danger" aria-label={`Supprimer ${piano.name}`} onClick={() => void onDeletePiano(piano.id)}><Trash2 /></button></div></article>)}
      {!total && <div className="empty-equipment"><Music2 /><strong>Aucun instrument personnel</strong><p>Ajoute ton accordéon ou ton piano pour retrouver sa configuration sur tous tes appareils.</p></div>}
    </div>
    <button type="button" className="account-add-instrument" disabled={total >= 5} onClick={() => setEditor({ kind: 'choice' })}><Plus />{total >= 5 ? 'Limite de cinq instruments atteinte' : `Ajouter un instrument · ${total}/5`}</button>
    {editor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}><div className="profile-instrument-editor" role="dialog" aria-modal="true"><header><div><small>MON MATÉRIEL</small><h2>{editor.kind === 'choice' ? 'Quel instrument ajouter ?' : editor.value.id === 'draft' ? 'Ajouter un instrument' : 'Modifier l’instrument'}</h2></div><button type="button" onClick={() => setEditor(null)} aria-label="Fermer"><X /></button></header>
      {editor.kind === 'choice' ? <div className="instrument-kind-choice"><button type="button" onClick={newAccordion}><Music2 /><strong>Accordéon</strong><span>Nom et configuration</span></button><button type="button" onClick={newPiano}><Piano /><strong>Piano</strong><span>Clavier, entrée et notes</span></button></div> : <div className="profile-instrument-fields">
        {editor.kind === 'piano' ? <><label>Nom du piano<input value={editor.value.name} maxLength={100} onChange={(event) => setEditor({ kind: 'piano', value: { ...editor.value, name: event.target.value } })} /></label><label>Nombre de touches<select value={editor.value.keyboardSize} onChange={(event) => setEditor({ kind: 'piano', value: { ...editor.value, keyboardSize: Number(event.target.value) as PianoKeyboardSize } })}>{[25, 32, 49, 61, 76, 88].map((size) => <option key={size} value={size}>{size} touches</option>)}</select></label><label>Entrée<select value={editor.value.input} onChange={(event) => setEditor({ kind: 'piano', value: { ...editor.value, input: event.target.value as PianoInput } })}>{pianoInputs.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>Nom des notes<select value={editor.value.notation} onChange={(event) => setEditor({ kind: 'piano', value: { ...editor.value, notation: event.target.value as 'french' | 'english' } })}><option value="french">Français · Do Ré Mi</option><option value="english">International · C D E</option></select></label></> : <><label>Nom de l’accordéon<input value={editor.value.maker} maxLength={80} onChange={(event) => setEditor({ kind: 'accordion', value: { ...editor.value, maker: event.target.value } })} /></label><label>Configuration<select value={templates.find((item) => item.tuning === editor.value.tuning)?.id ?? ''} onChange={(event) => { const base = templates.find((item) => item.id === event.target.value); if (base) setEditor({ kind: 'accordion', value: { ...structuredClone(base), id: editor.value.id, maker: editor.value.maker, verified: false } }); }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.model} · {item.tuning} · {item.rightRows.length} rangées / {item.bassCount} basses</option>)}</select></label><div className="instrument-config-summary"><Music2 /><span><strong>{editor.value.tuning}</strong>{editor.value.rightRows.join('+')} boutons main droite · {editor.value.bassCount} basses</span><Check /></div></>}
        {error && <div className="account-message is-error"><AlertTriangle />{error}</div>}<footer><button type="button" className="secondary-button" onClick={() => setEditor(null)}>Annuler</button><button type="button" className="primary-button" disabled={saving || (editor.kind === 'piano' ? !editor.value.name.trim() : !editor.value.maker.trim())} onClick={() => void save()}><Save />{saving ? 'Enregistrement…' : 'Enregistrer'}</button></footer>
      </div>}
    </div></div>}
  </section>;
}
