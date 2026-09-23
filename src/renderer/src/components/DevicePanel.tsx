import { useState } from 'react';
import { Check, FlaskConical, Headset, Radio } from 'lucide-react';
import type { AppState } from '../../../shared/types';
import { DeviceConnectionForm } from './DeviceConnectionForm';

export function DevicePanel({
  state,
  busy,
  run,
}: {
  state: AppState;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const [host, setHost] = useState('frame.local');
  const [port, setPort] = useState('32000');
  const connected = state.connected;
  const working = state.jobs.some((job) =>
    ['queued', 'uploading', 'registering'].includes(job.status),
  );
  const demo = state.mode === 'demo';
  return (
    <section
      className="card card-border bg-base-100 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      aria-labelledby="device-title"
    >
      <div className="card-body gap-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-base-content/80">
          <span>{demo ? 'Your simulator' : 'Your headset'}</span>
          <Radio size={16} aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-box bg-base-200 p-3">
            <Headset size={28} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="device-title" className="card-title text-base wrap-anywhere">
              {demo ? 'Steam Frame simulator' : connected?.name || 'Steam Frame'}
            </h2>
            <div
              className="mt-2 flex items-center gap-2 text-xs text-base-content/80 wrap-anywhere"
              role="status"
            >
              <span
                className={`status status-xs shrink-0 ${connected ? 'status-success' : ''}`}
                aria-hidden="true"
              />
              {connected ? (demo ? 'Simulated connection' : connected.host) : 'Waiting to connect'}
            </div>
          </div>
        </div>
        {connected ? (
          <>
            <div className="alert alert-horizontal alert-success items-start text-sm">
              <Check size={18} aria-hidden="true" />
              <p>
                {demo
                  ? 'Ready to test the install flow. Files stay on this computer.'
                  : 'Ready for uploads. Keep your headset awake and on the same network.'}
              </p>
            </div>
            {connected.fingerprint && (
              <details className="collapse collapse-arrow border border-base-300">
                <summary className="collapse-title text-sm font-medium">SSH fingerprint</summary>
                <div className="collapse-content">
                  <code className="text-xs wrap-anywhere">{connected.fingerprint}</code>
                </div>
              </details>
            )}
            <button
              className="btn w-full"
              disabled={busy || working}
              onClick={() => run(() => window.opendrop.disconnect())}
            >
              Disconnect
            </button>
          </>
        ) : demo ? (
          <>
            <p className="text-base-content/80">
              Try pairing, uploads and the library without a headset.
            </p>
            <button
              className="btn w-full"
              disabled={busy}
              onClick={() => run(() => window.opendrop.connect('demo', 32000, false))}
            >
              <FlaskConical size={16} aria-hidden="true" />
              Connect simulator
            </button>
          </>
        ) : (
          <DeviceConnectionForm
            devices={state.devices}
            host={host}
            setHost={setHost}
            port={port}
            setPort={setPort}
            busy={busy}
            run={run}
          />
        )}
      </div>
    </section>
  );
}
