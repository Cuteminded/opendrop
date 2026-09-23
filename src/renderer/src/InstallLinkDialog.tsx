import { ArrowDownToLine, CircleAlert, Link, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function InstallLinkDialog({
  busy,
  error,
  url,
  setUrl,
  close,
  submit,
}: {
  busy: boolean;
  error: string;
  url: string;
  setUrl: (url: string) => void;
  close: () => void;
  submit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    input.current?.focus();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="url-title"
      aria-describedby="url-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <section className="modal-box w-[calc(100%-2rem)] max-w-lg space-y-5 overscroll-contain p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-box bg-primary p-3 text-primary-content">
            <Link size={24} aria-hidden="true" />
          </div>
          <button
            className="btn btn-ghost btn-square btn-sm"
            aria-label="Close link dialog"
            disabled={busy}
            onClick={close}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div>
          <h2 id="url-title" className="text-2xl font-semibold tracking-tight">
            Install from a link
          </h2>
          <p id="url-description" className="mt-2 text-base-content/80">
            Use a public HTTPS build URL or an OpenDrop JSON manifest.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) submit();
          }}
        >
          <label className="fieldset p-0 text-sm">
            <span className="label text-base-content/80">Build or manifest URL</span>
            <input
              className={`input w-full ${error ? 'input-error' : ''}`}
              ref={input}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? 'url-hint url-error' : 'url-hint'}
              required
              disabled={busy}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/my-app.apk"
            />
          </label>
          <p className="text-xs text-base-content/80" id="url-hint">
            The build is downloaded for review. Installation starts only after you choose Install.
          </p>
          {error && (
            <div
              className="modal-error alert alert-horizontal alert-error items-start text-sm wrap-anywhere"
              id="url-error"
              role="alert"
            >
              <CircleAlert size={18} aria-hidden="true" />
              <p>{error} Check the link and try again.</p>
            </div>
          )}
          <div className="modal-action">
            <button className="btn btn-primary w-full" type="submit" disabled={busy || !url.trim()}>
              {busy ? (
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
              ) : (
                <ArrowDownToLine size={16} aria-hidden="true" />
              )}
              {busy ? 'Downloading and checking...' : 'Download for review'}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}
