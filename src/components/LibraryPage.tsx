import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock3, FileMusic, Filter, Import, LayoutGrid, List, LoaderCircle, Music2, Pencil, Play, RefreshCw, Save, Search, Sparkles, Trash2, X, Youtube } from 'lucide-react';
import type { Song } from '../types';

interface LibraryPageProps {
  songs: Song[];
  userId: string;
  onImport: () => void;
  onRefresh: () => Promise<void>;
  onPractice: (song: Song) => void;
  onEdit: (song: Song) => void;
  onRename: (song: Song, title: string) => Promise<void>;
  onDelete: (song: Song) => Promise<void>;
}

const REFRESH_THRESHOLD = 72;
type LibraryView = 'cards' | 'list';

function storedLibraryView(userId: string): LibraryView {
  try {
    return localStorage.getItem(`soufflet.libraryView.${userId}`) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function statusLabel(song: Song) {
  return song.status === 'ready' ? 'Prêt à jouer' : song.status === 'needs-review' ? 'À vérifier' : song.status === 'reference-only' ? 'Lien externe' : 'Analyse…';
}

export function LibraryPage({ songs, userId, onImport, onRefresh, onPractice, onEdit, onRename, onDelete }: LibraryPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'review'>('all');
  const [view, setView] = useState<LibraryView>(() => storedLibraryView(userId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'success' | 'error'>('idle');
  const pullStart = useRef<number | null>(null);
  const filteredSongs = useMemo(() => songs.filter((song) => {
    const matchesQuery = `${song.title} ${song.artist}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'ready' ? song.status === 'ready' : song.status === 'needs-review');
    return matchesQuery && matchesFilter;
  }), [filter, query, songs]);
  const iconFor = (song: Song) => song.sourceType === 'youtube' ? <Youtube /> : song.sourceType === 'spotify' ? <Music2 /> : <FileMusic />;
  const changeView = (next: LibraryView) => {
    setView(next);
    try { localStorage.setItem(`soufflet.libraryView.${userId}`, next); } catch { /* local preferences are optional */ }
  };
  const beginRename = (song: Song) => {
    setEditingId(song.id);
    setRenameValue(song.title);
    setConfirmDeleteId(null);
    setActionError('');
  };
  const renameSong = async (song: Song) => {
    const title = renameValue.trim();
    if (!title) { setActionError('Le titre ne peut pas être vide.'); return; }
    if (title === song.title) { setEditingId(null); return; }
    setWorkingId(song.id);
    setActionError('');
    try {
      await onRename(song, title);
      setEditingId(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Le morceau n’a pas pu être renommé.');
    } finally {
      setWorkingId(null);
    }
  };
  const deleteSong = async (song: Song) => {
    setWorkingId(song.id);
    setActionError('');
    try {
      await onDelete(song);
      setConfirmDeleteId(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Le morceau n’a pas pu être supprimé.');
    } finally {
      setWorkingId(null);
    }
  };
  const refresh = async () => {
    if (refreshState === 'refreshing') return;
    setRefreshState('refreshing');
    try {
      await onRefresh();
      setRefreshState('success');
      window.setTimeout(() => setRefreshState('idle'), 1_800);
    } catch {
      setRefreshState('error');
      window.setTimeout(() => setRefreshState('idle'), 3_000);
    }
  };
  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    pullStart.current = window.scrollY <= 2 && refreshState !== 'refreshing' ? event.touches[0]?.clientY ?? null : null;
  };
  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (pullStart.current === null || window.scrollY > 2) return;
    const delta = Math.max(0, (event.touches[0]?.clientY ?? pullStart.current) - pullStart.current);
    setPullDistance(Math.min(104, delta * .5));
  };
  const onTouchEnd = () => {
    const shouldRefresh = pullDistance >= REFRESH_THRESHOLD;
    pullStart.current = null;
    setPullDistance(0);
    if (shouldRefresh) void refresh();
  };
  return (
    <main className="page-content library-page" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div className={`library-pull-indicator is-${refreshState}`} style={{ height: pullDistance }} aria-hidden="true">
        {refreshState === 'refreshing' ? <LoaderCircle /> : refreshState === 'success' ? <Check /> : <RefreshCw className={pullDistance >= REFRESH_THRESHOLD ? 'is-ready' : ''} />}
        <span>{refreshState === 'refreshing' ? 'Synchronisation…' : refreshState === 'success' ? 'Bibliothèque à jour' : pullDistance >= REFRESH_THRESHOLD ? 'Relâche pour actualiser' : 'Tire pour actualiser'}</span>
      </div>
      <header className="page-heading split-heading"><div><span className="eyebrow">Ton répertoire</span><h1>Bibliothèque</h1><p>Chaque morceau devient un terrain d’entraînement à ta mesure.</p></div><button type="button" className="primary-button" onClick={onImport}><Import /> Importer un morceau</button></header>
      <div className="library-tools"><label className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un morceau ou un artiste" /></label><button type="button" className="filter-button" onClick={() => setFilter(filter === 'all' ? 'ready' : filter === 'ready' ? 'review' : 'all')}><Filter /> {filter === 'all' ? 'Tous les morceaux' : filter === 'ready' ? 'Prêts à jouer' : 'À vérifier'}</button><button type="button" className={`filter-button library-refresh-button is-${refreshState}`} onClick={() => void refresh()} disabled={refreshState === 'refreshing'} aria-label="Actualiser la bibliothèque"><RefreshCw /> {refreshState === 'refreshing' ? 'Actualisation…' : refreshState === 'success' ? 'À jour' : 'Actualiser'}</button><div className="library-view-switch" role="group" aria-label="Présentation de la bibliothèque"><button type="button" className={view === 'cards' ? 'is-active' : ''} aria-pressed={view === 'cards'} aria-label="Vue en cartes" title="Vue en cartes" onClick={() => changeView('cards')}><LayoutGrid /></button><button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} aria-label="Vue en liste" title="Vue en liste" onClick={() => changeView('list')}><List /></button></div><div className="library-count">{filteredSongs.length} morceau{filteredSongs.length > 1 ? 'x' : ''}</div></div>
      <p className={`library-refresh-status is-${refreshState}`} aria-live="polite">{refreshState === 'success' ? 'Les morceaux de ton compte sont à jour sur cet appareil.' : refreshState === 'error' ? 'Impossible d’actualiser. Vérifie ta connexion puis réessaie.' : ''}</p>
      {actionError && <div className="library-action-error" role="alert"><AlertTriangle />{actionError}<button type="button" aria-label="Fermer le message" onClick={() => setActionError('')}><X /></button></div>}

      {view === 'cards' ? <section className="song-grid">
        <button type="button" className="add-song-card" onClick={onImport}><span><Sparkles /></span><strong>Transformer un nouveau morceau</strong><p>Audio, vidéo, partition, tablature ou lien</p><em>Importer <Import /></em></button>
        {filteredSongs.map((song, index) => (
          <article className="song-card" key={song.id} title={song.provenance}>
            <div className={`song-cover cover-${index % 4}`}><span>{iconFor(song)}</span><button type="button" aria-label={song.events.length ? `Jouer ${song.title}` : `Ouvrir ${song.title}`} onClick={() => song.events.length ? onPractice(song) : onEdit(song)}><Play fill="currentColor" /></button><small>{song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : 'Référence'}</small></div>
            <div className="song-card-body"><div><span className={`status-pill status-${song.status}`}>{statusLabel(song)}</span></div><h3>{song.title}</h3><p>{song.artist}</p><div className="song-facts"><span>{song.bpm} BPM</span><span>{song.key}</span><span>Niveau {Math.max(1, song.difficulty)}</span></div>{song.status === 'needs-review' && <button type="button" className="review-link" onClick={() => onEdit(song)}><AlertTriangle /> Vérifier {song.uncertainBeats?.length ?? 0} passage(s)</button>}{song.status === 'reference-only' && <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="review-link"><Music2 /> Ouvrir la source</a>}</div>
          </article>
        ))}
      </section> : <section className="song-list" aria-label="Morceaux en liste">
        <button type="button" className="add-song-row" onClick={onImport}><span><Sparkles /></span><strong>Transformer un nouveau morceau</strong><small>Audio, vidéo, partition ou lien</small><em>Importer <Import /></em></button>
        {filteredSongs.map((song, index) => {
          const editing = editingId === song.id;
          const confirmingDelete = confirmDeleteId === song.id;
          const working = workingId === song.id;
          return <article className="song-list-row" key={song.id} title={song.provenance}>
            <div className={`song-list-icon cover-${index % 4}`}>{iconFor(song)}</div>
            <div className="song-list-identity">
              {editing ? <form onSubmit={(event) => { event.preventDefault(); void renameSong(song); }}><input autoFocus value={renameValue} maxLength={160} onChange={(event) => setRenameValue(event.target.value)} aria-label={`Nouveau titre de ${song.title}`} /><button type="submit" disabled={working} aria-label="Enregistrer le nouveau titre"><Save /></button><button type="button" disabled={working} aria-label="Annuler le renommage" onClick={() => setEditingId(null)}><X /></button></form> : <><strong>{song.title}</strong><span>{song.artist}</span></>}
            </div>
            <span className={`status-pill status-${song.status}`}>{statusLabel(song)}</span>
            <div className="song-list-facts"><span>{song.bpm ? `${song.bpm} BPM` : 'Tempo à définir'}</span><span>{song.key}</span><span>Niveau {Math.max(1, song.difficulty)}</span></div>
            <div className="song-list-actions">
              {confirmingDelete ? <div className="song-delete-confirm"><span>Supprimer ?</span><button type="button" disabled={working} onClick={() => setConfirmDeleteId(null)}>Annuler</button><button type="button" className="is-danger" disabled={working} onClick={() => void deleteSong(song)}>{working ? <LoaderCircle /> : <Trash2 />} Confirmer</button></div> : <><button type="button" className="song-list-play" onClick={() => song.events.length ? onPractice(song) : onEdit(song)}><Play fill="currentColor" /> {song.events.length ? 'Jouer' : 'Ouvrir'}</button>{!song.builtIn && <><button type="button" className="icon-button" aria-label={`Renommer ${song.title}`} title="Renommer" onClick={() => beginRename(song)}><Pencil /></button><button type="button" className="icon-button is-danger" aria-label={`Supprimer ${song.title}`} title="Supprimer" onClick={() => { setConfirmDeleteId(song.id); setEditingId(null); setActionError(''); }}><Trash2 /></button></>}</>}
            </div>
          </article>;
        })}
      </section>}

      <section className="library-tip"><Clock3 /><div><strong>Conseil du jour</strong><p>Rejouer un passage difficile après 24 h consolide mieux la mémoire que de le répéter longtemps en une seule séance.</p></div><button type="button">Voir mes révisions</button></section>
    </main>
  );
}
