import { ArrowDownToLine, Link, LoaderCircle, X } from 'lucide-react';
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
      <section className="modal-box url-dialog">
        <div className="section-heading">
          <div className="modal-icon">
            <Link size={24} />
          </div>
          <button
            className="btn btn-ghost btn-square btn-xs icon-button"
            aria-label="Close link dialog"
            disabled={busy}
            onClick={() => close()}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="url-title">Install from a link</h2>
        <p id="url-description">Use a public HTTPS build URL or an OpenDrop JSON manifest.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) submit();
          }}
        >
          <label className="field">
            Build or manifest URL
            <input
              className="input input-sm"
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
          <p className="hint" id="url-hint">
            The build is downloaded for review. Installation starts only after you choose Install.
          </p>
          {error && (
            <p className="modal-error" id="url-error" role="alert">
              {error}
              <span> Check the link and try again.</span>
            </p>
          )}
          <button
            className="btn btn-sm btn-primary full"
            type="submit"
            disabled={busy || !url.trim()}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowDownToLine size={16} />}
            {busy ? 'Downloading and checking...' : 'Download for review'}
          </button>
        </form>
      </section>
    </dialog>
  );
}
