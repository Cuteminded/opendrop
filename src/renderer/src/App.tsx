import { useEffect, useState } from 'react';
import { CircleAlert, FlaskConical, LoaderCircle, PackageOpen, X } from 'lucide-react';
import type { AppState, Build } from '../../shared/types';
import { InstallLinkDialog } from './InstallLinkDialog';
import { Sidebar } from './Sidebar';
import { useTheme } from './useTheme';
import { BuildReview, DevicePanel, DropZone, JobList } from './components';
import { Library } from './components/Library';
import { Activity } from './components/Activity';

const initial: AppState = { mode: 'device', devices: [], jobs: [], logs: [] };
export default function App() {
  const { appearance, setAppearance } = useTheme();
  const [state, setState] = useState<AppState>(initial);
  const [page, setPage] = useState<'install' | 'library' | 'activity'>('install');
  const [build, setBuild] = useState<Build | null>(null);
  const [name, setName] = useState('');
  const [entrypoint, setEntrypoint] = useState('');
  const [error, setError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [libraryFilters, setLibraryFilters] = useState({ search: '', platform: 'all' });
  const busy = localBusy || !!state.busy;
  const working = state.jobs.some((job) =>
    ['queued', 'uploading', 'registering'].includes(job.status),
  );
  const demo = state.mode === 'demo';
  const installed = state.jobs.filter((job) => job.status === 'installed');

  useEffect(() => {
    const unsubscribe = window.opendrop.subscribe(setState);
    void window.opendrop
      .state()
      .then(setState)
      .catch((e) => setError(String(e)));
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (state.pendingUrl) {
      setError('');
      setUrl(state.pendingUrl);
      setUrlOpen(true);
    }
  }, [state.pendingUrl]);

  function run(action: () => Promise<unknown>) {
    setError('');
    setLocalBusy(true);
    void action()
      .catch((e) =>
        setError(
          String(e instanceof Error ? e.message : e).replace(
            /^Error invoking remote method '[^']+': Error: /,
            '',
          ),
        ),
      )
      .finally(() => setLocalBusy(false));
  }
  async function review(next: Build | null) {
    if (!next) return;
    if (build) await window.opendrop.discard(build.id);
    setBuild(next);
    setName(next.name);
    setEntrypoint(next.candidates.length === 1 ? next.candidates[0].path : '');
    setPage('install');
  }
  const currentJobs = state.jobs.filter((job) => job.mode === state.mode);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        appearance={appearance}
        setAppearance={setAppearance}
        page={page}
        setPage={setPage}
        demo={demo}
        disabled={busy || working}
        installed={installed.length}
        toggleMode={() =>
          run(async () => {
            await window.opendrop.mode(demo ? 'device' : 'demo');
            setBuild(null);
          })
        }
      />
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar-label">Workspace</span>
            <span className="slash">/</span>
            <span>
              {page === 'install' ? 'Install' : page === 'library' ? 'Library' : 'Activity'}
            </span>
          </div>
          <div className="topbar-right">
            {demo && (
              <span className="badge badge-sm badge-soft badge-primary test-badge">
                <FlaskConical size={12} />
                Test mode
              </span>
            )}
            <span className="topbar-status">
              <i className={state.connected ? 'online' : ''} />
              {state.connected
                ? demo
                  ? 'Simulator connected'
                  : 'Headset connected'
                : demo
                  ? 'Simulator disconnected'
                  : 'No headset connected'}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {demo && (
            <div className="demo-banner">
              <FlaskConical size={16} />
              <span>
                Test mode. Installs and launches are simulated. Files stay on this computer.
              </span>
            </div>
          )}
          {error && !urlOpen && (
            <div className="alert alert-error alert-soft error-banner" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button
                aria-label="Dismiss error"
                className="btn btn-ghost btn-square btn-xs icon-button"
                onClick={() => setError('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {state.busy && (
            <div className="busy-bar" role="status">
              <LoaderCircle size={15} className="spin" />
              {state.busy}...
            </div>
          )}
          {page === 'install' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Install a build</h1>
                  <p>Send an app to your {demo ? 'simulator' : 'Steam Frame'} in a few steps.</p>
                </div>
              </div>
              <div className="install-grid">
                <div className="build-column">
                  {build ? (
                    <BuildReview
                      build={build}
                      name={name}
                      setName={setName}
                      entrypoint={entrypoint}
                      setEntrypoint={setEntrypoint}
                      connected={!!state.connected}
                      demo={demo}
                      busy={busy}
                      discard={() =>
                        run(async () => {
                          await window.opendrop.discard(build.id);
                          setBuild(null);
                        })
                      }
                      install={() =>
                        run(async () => {
                          await window.opendrop.install({ buildId: build.id, name, entrypoint });
                          setBuild(null);
                        })
                      }
                    />
                  ) : (
                    <DropZone
                      busy={busy}
                      demo={demo}
                      onPick={(folder) =>
                        run(async () => review(await window.opendrop.pick(folder)))
                      }
                      onDrop={(file) =>
                        run(async () =>
                          review(await window.opendrop.inspect(window.opendrop.filePath(file))),
                        )
                      }
                      onSample={() => run(async () => review(await window.opendrop.demoBuild()))}
                      onUrl={() => {
                        setError('');
                        setUrlOpen(true);
                        setUrl('');
                      }}
                    />
                  )}
                  <div className="local-note">
                    <PackageOpen size={18} />
                    <div>
                      <strong>
                        {demo
                          ? 'Try an install without a headset.'
                          : 'Transfers stay on your local network.'}
                      </strong>
                      <p>
                        {demo
                          ? 'Use the sample build to explore the full flow.'
                          : 'OpenDrop sends your files directly to your Steam Frame.'}
                      </p>
                    </div>
                  </div>
                </div>
                <DevicePanel state={state} busy={busy} run={run} />
                <section className="queue-section" aria-labelledby="queue-title">
                  <div className="section-heading">
                    <h2 id="queue-title">
                      Install queue<span className="subtle-count">{currentJobs.length}</span>
                    </h2>
                    <span className="eyebrow">
                      {demo ? 'Simulated transfers' : 'Local transfers'}
                    </span>
                  </div>
                  <JobList jobs={currentJobs} state={state} busy={busy} run={run} />
                </section>
              </div>
            </>
          )}
          {page === 'library' && (
            <Library
              jobs={installed}
              state={state}
              busy={busy}
              run={run}
              filters={libraryFilters}
              setFilters={setLibraryFilters}
            />
          )}
          {page === 'activity' && <Activity logs={state.logs} />}
          <footer>
            <span>Built for an open headset.</span>
            <span>OpenDrop is not affiliated with Valve.</span>
          </footer>
        </main>
      </div>
      {urlOpen && (
        <InstallLinkDialog
          busy={busy}
          error={error}
          url={url}
          setUrl={setUrl}
          close={() => {
            setUrlOpen(false);
            setError('');
          }}
          submit={() =>
            run(async () => {
              const next = await window.opendrop.download(url.trim());
              await review(next);
              setUrlOpen(false);
            })
          }
        />
      )}
    </div>
  );
}
