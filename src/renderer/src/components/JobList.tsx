import { FolderOpen } from 'lucide-react';
import type { AppState, Job } from '../../../shared/types';
import { EmptyState } from './EmptyState';
import { JobItem } from './JobItem';

export function JobList({
  jobs,
  state,
  busy,
  run,
  library = false,
}: {
  jobs: Job[];
  state: AppState;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
  library?: boolean;
}) {
  if (!jobs.length)
    return (
      <EmptyState
        icon={FolderOpen}
        title={library ? 'No installed apps yet' : 'Nothing in the queue yet'}
      >
        {library
          ? 'Apps installed with OpenDrop will appear here.'
          : 'Choose a build above to start your first install.'}
      </EmptyState>
    );
  return (
    <ul
      className="list rounded-box border border-base-300 bg-base-100"
      aria-label={library ? 'Installed apps' : 'Install queue'}
    >
      {jobs.map((job) => (
        <JobItem key={job.id} job={job} state={state} busy={busy} run={run} />
      ))}
    </ul>
  );
}
