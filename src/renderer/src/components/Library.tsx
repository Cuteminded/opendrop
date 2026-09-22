import { useRef } from 'react';
import { Search } from 'lucide-react';
import type { AppState, Job } from '../../../shared/types';
import { JobList } from './JobList';

interface LibraryFilters {
  search: string;
  platform: string;
}

export function Library({
  jobs,
  state,
  busy,
  run,
  filters,
  setFilters,
}: {
  jobs: Job[];
  state: AppState;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
  filters: LibraryFilters;
  setFilters: (filters: LibraryFilters) => void;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const { search, platform } = filters;
  const filtered = jobs.filter(
    (job) =>
      job.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (platform === 'all' || job.runtime === platform),
  );
  const hasFilters = !!search.trim() || platform !== 'all';

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your library</h1>
          <p>Install history from your headsets and test sessions.</p>
        </div>
      </div>
      <div className="library-toolbar">
        <label className="field">
          Search library
          <input
            ref={searchInput}
            className="input input-sm"
            type="search"
            placeholder="Search apps..."
            value={search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <label className="field">
          Platform
          <select
            className="select select-sm"
            aria-label="Filter library"
            value={platform}
            onChange={(event) => setFilters({ ...filters, platform: event.target.value })}
          >
            <option value="all">All platforms</option>
            <option value="android">Android APK</option>
            <option value="linux">Linux ARM64</option>
            <option value="windows">Windows</option>
          </select>
        </label>
      </div>
      <p className="library-results" role="status">
        {filtered.length} of {jobs.length} {jobs.length === 1 ? 'app' : 'apps'}
      </p>
      {!filtered.length && hasFilters ? (
        <div className="empty-state">
          <Search size={27} strokeWidth={1.5} />
          <div>
            <strong>No matching apps</strong>
            <p>Try another name or platform.</p>
            <button
              className="btn btn-sm btn-neutral"
              onClick={() => {
                setFilters({ search: '', platform: 'all' });
                searchInput.current?.focus();
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <JobList library jobs={filtered} state={state} busy={busy} run={run} />
      )}
      <p className="hint library-hint">
        This is OpenDrop's local history. Apps removed on the headset may still appear here.
      </p>
    </>
  );
}
