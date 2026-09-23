import { useEffect, useState } from 'react';
import { CircleAlert, FlaskConical, PackageOpen, X } from 'lucide-react';
import type { AppState, Build } from '../../shared/types';
import { InstallLinkDialog } from './InstallLinkDialog';
import { Sidebar, type Page } from './Sidebar';
import { useTheme } from './useTheme';
import { BuildReview, DevicePanel, DropZone, JobList } from './components';
import { Library } from './components/Library';
import { Activity } from './components/Activity';
import { CommunityStore } from './components/CommunityStore';
import { PageHeading } from './components/PageHeading';

const initial: AppState = { mode: 'device', devices: [], jobs: [], logs: [] };
const pageTitles: Record<Page, string> = {
  install: 'Install',
  library: 'Library',
  'community-store': 'Community Store',
  activity: 'Activity',
};
export default function App() {
  const { appearance, setAppearance } = useTheme();
  const [state, setState] = useState<AppState>(initial);
  const [page, setPage] = useState<Page>('install');
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
    <div className="min-h-screen">
      <a
        className="btn btn-primary fixed start-4 top-4 z-50 -translate-y-24 focus:translate-y-0"
        href="#main-content"
      >
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
      <div className="min-w-0 md:ms-60">
        <header className="navbar flex-wrap justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-3 sm:px-6 lg:px-8">
          <div className="breadcrumbs py-0 text-sm">
            <ul>
              <li className="text-base-content/80">Workspace</li>
              <li>{pageTitles[page]}</li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {demo && (
              <span className="badge badge-sm badge-primary">
                <FlaskConical size={12} />
                Test mode
              </span>
            )}
            <span className="flex items-center gap-2 text-xs text-base-content/80">
              <span
                className={`status status-xs ${state.connected ? 'status-success' : ''}`}
                aria-hidden="true"
              />
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
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {demo && (
            <div className="alert alert-horizontal mb-6 border-base-300 bg-base-100 text-sm">
              <FlaskConical size={16} />
              <span>
                Test mode. Installs and launches are simulated. Files stay on this computer.
              </span>
            </div>
          )}
          {error && !urlOpen && (
            <div
              className="error-banner alert alert-horizontal alert-error mb-6 items-start wrap-anywhere"
              role="alert"
            >
              <CircleAlert size={18} />
              <span className="min-w-0">{error}</span>
              <button
                aria-label="Dismiss error"
                className="btn btn-ghost btn-square btn-sm"
                onClick={() => setError('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {state.busy && (
            <div className="mb-4 flex items-center gap-2 text-sm" role="status">
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
              {state.busy}...
            </div>
          )}
          {page === 'install' && (
            <>
              <PageHeading title="Install a build">
                Send an app to your {demo ? 'simulator' : 'Steam Frame'} in a few steps.
              </PageHeading>
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0">
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
                  <div className="local-note mt-5 flex items-start gap-3 px-1 text-xs text-base-content/80">
                    <PackageOpen size={18} />
                    <div>
                      <strong className="font-medium">
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
                <section
                  className="min-w-0 lg:col-start-1 lg:row-start-2"
                  aria-labelledby="queue-title"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2
                      id="queue-title"
                      className="flex items-center gap-2 text-base font-semibold"
                    >
                      Install queue
                      <span className="subtle-count badge badge-sm badge-neutral tabular-nums">
                        {currentJobs.length}
                      </span>
                    </h2>
                    <span className="text-xs text-base-content/80">
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
          {page === 'community-store' && <CommunityStore />}
          {page === 'activity' && <Activity logs={state.logs} />}
          <footer className="footer mt-8 flex flex-wrap justify-between gap-3 border-t border-base-300 pt-5 text-xs text-base-content/80">
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
