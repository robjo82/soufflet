import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock3, FileMusic, Filter, Import, LoaderCircle, Music2, Play, RefreshCw, Search, Sparkles, Youtube } from 'lucide-react';
import type { Song } from '../types';

interface LibraryPageProps {
  songs: Song[];
  onImport: () => void;
  onRefresh: () => Promise<void>;
  onPractice: (song: Song) => void;
  onEdit: (song: Song) => void;
}

const REFRESH_THRESHOLD = 72;

export function LibraryPage({ songs, onImport, onRefresh, onPractice, onEdit }: LibraryPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'review'>('all');
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'success' | 'error'>('idle');
  const pullStart = useRef<number | null>(null);
  const filteredSongs = useMemo(() => songs.filter((song) => {
    const matchesQuery = `${song.title} ${song.artist}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'ready' ? song.status === 'ready' : song.status === 'needs-review');
    return matchesQuery && matchesFilter;
  }), [filter, query, songs]);
  const iconFor = (song: Song) => song.sourceType === 'youtube' ? <Youtube /> : song.sourceType === 'spotify' ? <Music2 /> : <FileMusic />;
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
      <div className="library-tools"><label className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un morceau ou un artiste" /></label><button type="button" className="filter-button" onClick={() => setFilter(filter === 'all' ? 'ready' : filter === 'ready' ? 'review' : 'all')}><Filter /> {filter === 'all' ? 'Tous les morceaux' : filter === 'ready' ? 'Prêts à jouer' : 'À vérifier'}</button><button type="button" className={`filter-button library-refresh-button is-${refreshState}`} onClick={() => void refresh()} disabled={refreshState === 'refreshing'} aria-label="Actualiser la bibliothèque"><RefreshCw /> {refreshState === 'refreshing' ? 'Actualisation…' : refreshState === 'success' ? 'À jour' : 'Actualiser'}</button><div className="library-count">{filteredSongs.length} morceau{filteredSongs.length > 1 ? 'x' : ''}</div></div>
      <p className={`library-refresh-status is-${refreshState}`} aria-live="polite">{refreshState === 'success' ? 'Les morceaux de ton compte sont à jour sur cet appareil.' : refreshState === 'error' ? 'Impossible d’actualiser. Vérifie ta connexion puis réessaie.' : ''}</p>

      <section className="song-grid">
        <button type="button" className="add-song-card" onClick={onImport}><span><Sparkles /></span><strong>Transformer un nouveau morceau</strong><p>Audio, vidéo, partition, tablature ou lien</p><em>Importer <Import /></em></button>
        {filteredSongs.map((song, index) => (
          <article className="song-card" key={song.id} title={song.provenance}>
            <div className={`song-cover cover-${index % 4}`}><span>{iconFor(song)}</span><button type="button" aria-label={song.events.length ? `Jouer ${song.title}` : `Ouvrir ${song.title}`} onClick={() => song.events.length ? onPractice(song) : onEdit(song)}><Play fill="currentColor" /></button><small>{song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : 'Référence'}</small></div>
            <div className="song-card-body"><div><span className={`status-pill status-${song.status}`}>{song.status === 'ready' ? 'Prêt à jouer' : song.status === 'needs-review' ? 'À vérifier' : song.status === 'reference-only' ? 'Lien externe' : 'Analyse…'}</span></div><h3>{song.title}</h3><p>{song.artist}</p><div className="song-facts"><span>{song.bpm} BPM</span><span>{song.key}</span><span>Niveau {Math.max(1, song.difficulty)}</span></div>{song.status === 'needs-review' && <button type="button" className="review-link" onClick={() => onEdit(song)}><AlertTriangle /> Vérifier {song.uncertainBeats?.length ?? 0} passage(s)</button>}{song.status === 'reference-only' && <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="review-link"><Music2 /> Ouvrir la source</a>}</div>
          </article>
        ))}
      </section>

      <section className="library-tip"><Clock3 /><div><strong>Conseil du jour</strong><p>Rejouer un passage difficile après 24 h consolide mieux la mémoire que de le répéter longtemps en une seule séance.</p></div><button type="button">Voir mes révisions</button></section>
    </main>
  );
}
