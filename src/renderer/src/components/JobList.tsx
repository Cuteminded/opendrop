import { Check, CircleAlert, FolderOpen, LoaderCircle, Play, X } from 'lucide-react';
import { runtimeLabels, type AppState, type Job } from '../../../shared/types';
import { formatBytes } from './formatBytes';

const activeStatuses = ['queued', 'uploading', 'registering'];
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
      <div className="empty-state">
        <FolderOpen size={27} strokeWidth={1.3} />
        <div>
          <strong>{library ? 'No installed apps yet' : 'Nothing in the queue yet'}</strong>
          <p>
            {library
              ? 'Apps installed with OpenDrop will appear here.'
              : 'Choose a build above to start your first install.'}
          </p>
        </div>
      </div>
    );
  return (
    <div className="job-list">
      {jobs.map((job) => {
        const active = activeStatuses.includes(job.status);
        const launchHint =
          job.mode !== state.mode
            ? job.mode === 'demo'
              ? 'Turn on Test mode to launch this simulated app.'
              : 'Turn off Test mode and connect your headset to launch.'
            : job.device !== state.connected?.host
              ? job.mode === 'demo'
                ? 'Connect the simulator to launch.'
                : `Connect ${job.device} to launch.`
              : state.jobs.some((j) => activeStatuses.includes(j.status))
                ? 'Wait for pending installs to finish before launching.'
                : '';
        const progress = job.bytes
          ? Math.min(100, Math.round((job.transferred / job.bytes) * 100))
          : 0;
        const label =
          job.status === 'installed'
            ? job.mode === 'demo'
              ? 'Simulated'
              : 'Installed'
            : job.status === 'uploading'
              ? `${progress}%`
              : job.status[0].toUpperCase() + job.status.slice(1);
        return (
          <article className={`job-row ${job.status}`} key={job.id}>
            <div className={`job-icon ${job.runtime}`}>
              {job.runtime === 'android' ? (
                <span>apk</span>
              ) : job.runtime === 'linux' ? (
                <span>elf</span>
              ) : (
                <span>exe</span>
              )}
            </div>
            <div className="job-info">
              <strong>{job.name}</strong>
              <p>
                {runtimeLabels[job.runtime]}
                <span className="separator">/</span>
                {formatBytes(job.bytes)}
                {job.mode === 'demo' && (
                  <span className="badge badge-xs badge-outline mini-tag">TEST</span>
                )}
              </p>
              {active && (
                <progress
                  className="progress progress-primary"
                  value={job.status === 'registering' ? 100 : progress}
                  max={100}
                  aria-label={`${job.name} transfer progress`}
                />
              )}
              {job.error && <p className="job-error">{job.error}</p>}
              {job.status === 'installed' && launchHint && (
                <p id={`launch-hint-${job.id}`}>{launchHint}</p>
              )}
            </div>
            <span className={`job-status ${job.status}`} role="status">
              {job.status === 'installed' ? (
                <Check size={14} />
              ) : active ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <CircleAlert size={14} />
              )}
              {label}
            </span>
            {active && (
              <button
                className="btn btn-ghost btn-square btn-xs icon-button"
                aria-label={`Cancel ${job.name}`}
                onClick={() => run(() => window.opendrop.cancel(job.id))}
              >
                <X size={16} />
              </button>
            )}
            {job.status === 'installed' && (
              <button
                className="btn btn-ghost btn-square btn-xs icon-button launch"
                aria-label={`Launch ${job.name}`}
                aria-describedby={launchHint ? `launch-hint-${job.id}` : undefined}
                disabled={busy || !!launchHint}
                onClick={() => run(() => window.opendrop.launch(job.id))}
              >
                <Play size={16} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
