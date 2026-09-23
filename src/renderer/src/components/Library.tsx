import { useRef } from 'react';
import { Search } from 'lucide-react';
import type { AppState, Job } from '../../../shared/types';
import { EmptyState } from './EmptyState';
import { JobList } from './JobList';
import { PageHeading } from './PageHeading';

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
      <PageHeading title="Your library">
        Install history from your headsets and test sessions.
      </PageHeading>
      <div className="mb-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">Search library</span>
          <input
            ref={searchInput}
            className="input w-full"
            type="search"
            placeholder="Search apps..."
            value={search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">Platform</span>
          <select
            className="select w-full"
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
      <p className="mb-3 text-xs text-base-content/80 tabular-nums" role="status">
        {filtered.length} of {jobs.length} {jobs.length === 1 ? 'app' : 'apps'}
      </p>
      {!filtered.length && hasFilters ? (
        <EmptyState
          icon={Search}
          title="No matching apps"
          action={
            <button
              className="btn"
              onClick={() => {
                setFilters({ search: '', platform: 'all' });
                searchInput.current?.focus();
              }}
            >
              Clear filters
            </button>
          }
        >
          Try another name or platform.
        </EmptyState>
      ) : (
        <JobList library jobs={filtered} state={state} busy={busy} run={run} />
      )}
      <p className="mt-5 text-xs text-base-content/80">
        This is OpenDrop's local history. Apps removed on the headset may still appear here.
      </p>
    </>
  );
}
