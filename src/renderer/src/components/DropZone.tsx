import { useState } from 'react';
import { FilePlus2, Link, FolderOpen, FlaskConical, Upload } from 'lucide-react';

export function DropZone({
  busy,
  demo,
  onPick,
  onDrop,
  onSample,
  onUrl,
}: {
  busy: boolean;
  demo: boolean;
  onPick: (folder: boolean) => void;
  onDrop: (file: File) => void;
  onSample: () => void;
  onUrl: () => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <section
      className={`drop-zone ${drag ? 'dragging' : ''}`}
      aria-labelledby="drop-title"
      aria-busy={busy}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDrag(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDrag(false);
        if (!busy && event.dataTransfer.files[0]) onDrop(event.dataTransfer.files[0]);
      }}
    >
      <div className="upload-art" aria-hidden="true">
        <Upload size={31} strokeWidth={1.5} />
      </div>
      <h2 id="drop-title">Drop your build here</h2>
      <p>Choose a file or folder. You can review it before installing.</p>
      <div className="button-row centered">
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onPick(false)}>
          <FilePlus2 size={16} aria-hidden="true" />
          Choose file
        </button>
        <button
          className="btn btn-sm secondary-button"
          disabled={busy}
          onClick={() => onPick(true)}
        >
          <FolderOpen size={16} />
          Choose folder
        </button>
      </div>
      <div className="format-tags">
        <span>.apk</span>
        <span>.zip</span>
        <span>.exe</span>
        <span>Linux ARM64</span>
      </div>
      <div className="drop-footer">
        <button className="btn btn-link btn-xs text-button" disabled={busy} onClick={onUrl}>
          <Link size={14} aria-hidden="true" />
          Install from a link
        </button>
        {demo && (
          <button className="btn btn-link btn-xs text-button" disabled={busy} onClick={onSample}>
            Try a sample build
            <FlaskConical size={13} />
          </button>
        )}
      </div>
    </section>
  );
}
