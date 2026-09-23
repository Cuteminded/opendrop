import { ArrowDownToLine, CircleAlert, FolderOpen, FlaskConical, X } from 'lucide-react';
import { runtimeLabels, type Build } from '../../../shared/types';
import { formatBytes } from './formatBytes';

export function BuildReview({
  build,
  name,
  setName,
  entrypoint,
  setEntrypoint,
  connected,
  demo,
  busy,
  install,
  discard,
}: {
  build: Build;
  name: string;
  setName: (value: string) => void;
  entrypoint: string;
  setEntrypoint: (value: string) => void;
  connected: boolean;
  demo: boolean;
  busy: boolean;
  install: () => void;
  discard: () => void;
}) {
  const candidate = build.candidates.find((c) => c.path === entrypoint);
  return (
    <section className="card card-border bg-base-100" aria-labelledby="review-title">
      <div className="card-body gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="badge badge-sm badge-secondary mb-3">Build review</span>
            <h2 id="review-title" className="card-title text-xl">
              Check your build
            </h2>
          </div>
          <button
            className="btn btn-ghost btn-square btn-sm"
            aria-label="Discard build"
            disabled={busy}
            onClick={discard}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-box bg-base-200 p-4">
          <FolderOpen size={25} aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-32">
            <strong className="font-medium wrap-anywhere">{build.name}</strong>
            <p className="mt-1 text-xs text-base-content/80">
              {formatBytes(build.bytes)} · {build.fileCount} files
            </p>
          </div>
          <span className="badge badge-sm badge-outline">
            {candidate ? runtimeLabels[candidate.runtime] : 'Choose app'}
          </span>
        </div>
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">App name</span>
          <input
            className="input w-full"
            autoFocus
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">Start file</span>
          <select
            className="select w-full"
            aria-describedby={candidate ? 'selected-file' : 'start-file-hint'}
            value={entrypoint}
            onChange={(event) => setEntrypoint(event.target.value)}
          >
            {build.candidates.length > 1 && <option value="">Choose the app to launch</option>}
            {build.candidates.map((c) => (
              <option key={c.path} value={c.path}>
                {c.path} ({runtimeLabels[c.runtime]})
              </option>
            ))}
          </select>
        </label>
        {candidate ? (
          <p className="font-mono text-xs text-base-content/80 wrap-anywhere" id="selected-file">
            Selected file: {candidate.path}
          </p>
        ) : (
          <p className="text-sm text-base-content/80" id="start-file-hint">
            This build contains multiple apps. Choose which one to install.
          </p>
        )}
        <details className="collapse collapse-arrow border border-base-300 bg-base-100">
          <summary className="collapse-title text-sm font-medium">Build location</summary>
          <div className="collapse-content">
            <p className="font-mono text-xs text-base-content/80 wrap-anywhere">{build.source}</p>
          </div>
        </details>
        {candidate?.runtime === 'windows' && (
          <div className="alert alert-horizontal alert-warning text-sm">
            <CircleAlert size={18} aria-hidden="true" />
            <p>The headset needs a compatible ARM64 Proton runtime. Game compatibility varies.</p>
          </div>
        )}
        {build.warnings.map((warning) => (
          <div key={warning} className="alert alert-horizontal alert-warning text-sm wrap-anywhere">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{warning}</p>
          </div>
        ))}
        {!connected && (
          <p className="text-sm text-base-content/80">
            Connect your {demo ? 'simulator' : 'headset'} to continue.
          </p>
        )}
        <div className="card-actions">
          <button
            className="btn btn-primary w-full"
            disabled={busy || !connected || !candidate || !name.trim()}
            onClick={install}
          >
            {demo ? (
              <FlaskConical size={17} aria-hidden="true" />
            ) : (
              <ArrowDownToLine size={17} aria-hidden="true" />
            )}
            {demo ? 'Simulate installation' : 'Install on headset'}
          </button>
        </div>
        <p className="text-center text-xs text-base-content/80">
          {demo
            ? 'No files will be sent to a device.'
            : 'The app will appear in the Non-Steam section of your Steam library.'}
        </p>
      </div>
    </section>
  );
}
