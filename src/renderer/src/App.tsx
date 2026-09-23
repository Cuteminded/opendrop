import { useEffect, useState } from 'react';
import { CircleAlert, FlaskConical, X } from 'lucide-react';
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
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl p-4 sm:p-6 lg:px-8">
          {demo && (
            <div className="alert alert-horizontal mb-4 border-base-300 bg-base-100 text-sm">
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
              <div className="grid items-start gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_1fr]">
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
