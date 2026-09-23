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
      className={`card card-border border-dashed ${drag ? 'border-primary bg-base-300' : 'bg-base-100'}`}
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
      <div className="card-body items-center gap-3 px-5 py-5 text-center sm:px-8">
        <div className="rounded-box bg-primary p-3 text-primary-content" aria-hidden="true">
          <Upload size={28} strokeWidth={1.8} />
        </div>
        <div>
          <h2 id="drop-title" className="card-title justify-center text-xl">
            Drop your build here
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-base-content/80">
            Choose a file or folder. You can review it before installing.
          </p>
        </div>
        <div className="card-actions justify-center">
          <button className="btn btn-primary" disabled={busy} onClick={() => onPick(false)}>
            <FilePlus2 size={16} aria-hidden="true" />
            Choose file
          </button>
          <button className="btn" disabled={busy} onClick={() => onPick(true)}>
            <FolderOpen size={16} aria-hidden="true" />
            Choose folder
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2" aria-label="Supported formats">
          {['.apk', '.zip', '.exe', 'Linux ARM64'].map((format) => (
            <span className="badge badge-sm badge-ghost font-mono" key={format}>
              {format}
            </span>
          ))}
        </div>
        <div className="divider my-0" />
        <div className="card-actions justify-center">
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onUrl}>
            <Link size={14} aria-hidden="true" />
            Install from a link
          </button>
          {demo && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onSample}>
              <FlaskConical size={14} aria-hidden="true" />
              Try a sample build
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
