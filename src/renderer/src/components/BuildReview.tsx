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
    <section className="card card-border build-review">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Build review</span>
          <h2>Check your build</h2>
        </div>
        <button
          className="btn btn-ghost btn-square btn-xs icon-button"
          aria-label="Discard build"
          disabled={busy}
          onClick={discard}
        >
          <X size={18} />
        </button>
      </div>
      <div className="file-summary">
        <div className="file-icon">
          <FolderOpen size={25} />
        </div>
        <div>
          <strong>{build.name}</strong>
          <p>
            {formatBytes(build.bytes)}
            <span className="separator">/</span>
            {build.fileCount} files
          </p>
        </div>
        <span className="badge badge-sm badge-outline tag">
          {candidate ? runtimeLabels[candidate.runtime] : 'Choose app'}
        </span>
      </div>
      <label className="field">
        App name
        <input
          className="input input-sm"
          autoFocus
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        Start file
        <select
          className="select select-sm"
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
        <p className="source-path" id="selected-file">
          Selected file: {candidate.path}
        </p>
      ) : (
        <p className="hint" id="start-file-hint">
          This build contains multiple apps. Choose which one to install.
        </p>
      )}
      <details className="source-details">
        <summary>Build location</summary>
        <p className="source-path">{build.source}</p>
      </details>
      {candidate?.runtime === 'windows' && (
        <div className="alert alert-warning alert-soft notice">
          <CircleAlert size={15} />
          <p>The headset needs a compatible ARM64 Proton runtime. Game compatibility varies.</p>
        </div>
      )}
      {build.warnings.map((warning) => (
        <div key={warning} className="alert alert-warning alert-soft notice">
          <CircleAlert size={15} />
          <p>{warning}</p>
        </div>
      ))}
      {!connected && (
        <p className="connect-prompt">Connect your {demo ? 'simulator' : 'headset'} to continue.</p>
      )}
      <button
        className="btn btn-sm btn-primary full install-button"
        disabled={busy || !connected || !candidate || !name.trim()}
        onClick={install}
      >
        {demo ? <FlaskConical size={17} /> : <ArrowDownToLine size={17} />}
        {demo ? 'Simulate installation' : 'Install on headset'}
      </button>
      <p className="hint">
        {demo
          ? 'No files will be sent to a device.'
          : 'The app will appear in the Non-Steam section of your Steam library.'}
      </p>
    </section>
  );
}
