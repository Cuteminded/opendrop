import { Check, CircleAlert, Play, X } from 'lucide-react';
import { runtimeLabels, type AppState, type Job } from '../../../shared/types';
import { formatBytes } from './formatBytes';

const activeStatuses = ['queued', 'uploading', 'registering'];
const runtimeBadges = {
  android: { label: 'apk', className: 'badge-accent' },
  linux: { label: 'elf', className: 'badge-secondary' },
  windows: { label: 'exe', className: 'badge-info' },
};

function getLaunchHint(job: Job, state: AppState) {
  if (job.mode !== state.mode)
    return job.mode === 'demo'
      ? 'Turn on Test mode to launch this simulated app.'
      : 'Turn off Test mode and connect your headset to launch.';
  if (job.device !== state.connected?.host)
    return job.mode === 'demo'
      ? 'Connect the simulator to launch.'
      : `Connect ${job.device} to launch.`;
  if (state.jobs.some((item) => activeStatuses.includes(item.status)))
    return 'Wait for pending installs to finish before launching.';
  return '';
}

export function JobItem({
  job,
  state,
  busy,
  run,
}: {
  job: Job;
  state: AppState;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const active = activeStatuses.includes(job.status);
  const launchHint = getLaunchHint(job, state);
  const runtime = runtimeBadges[job.runtime];
  const progress = job.bytes ? Math.min(100, Math.round((job.transferred / job.bytes) * 100)) : 0;
  const label =
    job.status === 'installed'
      ? job.mode === 'demo'
        ? 'Simulated'
        : 'Installed'
      : job.status === 'uploading'
        ? `${progress}%`
        : job.status[0].toUpperCase() + job.status.slice(1);
  const statusClass =
    job.status === 'installed'
      ? 'badge-success'
      : job.status === 'failed'
        ? 'badge-error'
        : active
          ? 'badge-primary'
          : 'badge-ghost';

  return (
    <li className="job-row list-row grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
      <span className={`badge ${runtime.className} mt-1 font-mono text-xs`}>{runtime.label}</span>
      <div className="min-w-0">
        <strong className="font-medium wrap-anywhere">{job.name}</strong>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/80">
          <span>
            {runtimeLabels[job.runtime]} · {formatBytes(job.bytes)}
          </span>
          {job.mode === 'demo' && <span className="badge badge-sm badge-outline">TEST</span>}
        </div>
        {active && (
          <progress
            className="progress progress-primary mt-3 block h-1.5 w-full"
            value={job.status === 'registering' ? 100 : progress}
            max={100}
            aria-label={`${job.name} transfer progress`}
          />
        )}
        {job.error && (
          <p className="job-error mt-2 text-xs text-error wrap-anywhere">{job.error}</p>
        )}
        {job.status === 'installed' && launchHint && (
          <p
            className="mt-2 text-xs text-base-content/80 wrap-anywhere"
            id={`launch-hint-${job.id}`}
          >
            {launchHint}
          </p>
        )}
      </div>
      <div className="list-col-wrap col-start-2 flex flex-wrap items-center justify-between gap-3">
        <span className={`job-status badge badge-sm ${statusClass} tabular-nums`} role="status">
          {job.status === 'installed' ? (
            <Check size={14} aria-hidden="true" />
          ) : active ? (
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
          ) : (
            <CircleAlert size={14} aria-hidden="true" />
          )}
          {label}
        </span>
        {active && (
          <button
            className="btn btn-ghost btn-square btn-sm"
            aria-label={`Cancel ${job.name}`}
            onClick={() => run(() => window.opendrop.cancel(job.id))}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        {job.status === 'installed' && (
          <button
            className="btn btn-sm"
            aria-label={`Launch ${job.name}`}
            aria-describedby={launchHint ? `launch-hint-${job.id}` : undefined}
            disabled={busy || !!launchHint}
            onClick={() => run(() => window.opendrop.launch(job.id))}
          >
            <Play size={14} aria-hidden="true" />
            Launch
          </button>
        )}
      </div>
    </li>
  );
}
