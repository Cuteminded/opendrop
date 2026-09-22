import { useState } from 'react';
import { Check, FlaskConical, Radio, Search } from 'lucide-react';
import type { AppState } from '../../../shared/types';

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
    <section className="card card-border device-panel">
      <div className="eyebrow">
        <span>{demo ? 'Your simulator' : 'Your headset'}</span>
        <Radio size={15} />
      </div>
      <div className="device-identity">
        <div className={`headset-art ${connected ? 'connected' : ''}`}>
          <svg width="113" height="80" viewBox="0 0 128 82" fill="none" aria-hidden="true">
            <path
              d="M34 29C34 8 94 8 94 29M22 34H14V52H22M106 34H114V52H106"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M31 27H97C104 27 108 34 107 41L104 59C103 65 98 69 91 69H78L71 61H57L50 69H37C30 69 25 65 24 59L21 41C20 34 24 27 31 27Z"
              fill="var(--color-base-200)"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M36 39H92M43 50H47M81 50H85"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="32" cy="35" r="1.5" fill="currentColor" />
            <circle cx="96" cy="35" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="device-name">
          <h2>{demo ? 'Steam Frame simulator' : connected?.name || 'Steam Frame'}</h2>
          <div className="connection-label" role="status">
            <i className={connected ? 'online' : ''} />
            {connected ? (demo ? 'Simulated connection' : connected.host) : 'Waiting to connect'}
          </div>
        </div>
      </div>
      {connected ? (
        <>
          <div className="alert alert-success alert-soft device-note">
            <Check size={16} />
            <p>
              {demo
                ? 'Ready to test the install flow. Files stay on this computer.'
                : 'Ready for uploads. Keep your headset awake and on the same network.'}
            </p>
          </div>
          {connected.fingerprint && (
            <details className="fingerprint">
              <summary>SSH fingerprint</summary>
              <code>{connected.fingerprint}</code>
            </details>
          )}
          <button
            className="btn btn-sm secondary-button full"
            disabled={busy || working}
            onClick={() => run(() => window.opendrop.disconnect())}
          >
            Disconnect
          </button>
        </>
      ) : demo ? (
        <>
          <p className="muted device-description">
            Try pairing, uploads and the library without a headset.
          </p>
          <button
            className="btn btn-sm secondary-button full"
            disabled={busy}
            onClick={() => run(() => window.opendrop.connect('demo', 32000, false))}
          >
            <FlaskConical size={16} />
            Connect simulator
          </button>
        </>
      ) : (
        <>
          <ol className="setup-steps">
            <li>Enable Developer Mode on your Frame.</li>
            <li>Open Developer &gt; Pair new host.</li>
            <li>Keep both devices on the same Wi-Fi.</li>
          </ol>
          <button
            className="btn btn-sm secondary-button full"
            disabled={busy}
            onClick={() => run(() => window.opendrop.discover())}
          >
            <Search size={15} />
            Find headset
          </button>
          {state.devices.length > 0 && (
            <label className="field">
              Discovered devices
              <select
                className="select select-sm"
                aria-label="Discovered devices"
                value=""
                onChange={(event) => {
                  const d = state.devices[Number(event.target.value)];
                  setHost(d.host);
                  setPort(String(d.port));
                }}
              >
                <option value="" disabled>
                  Select a headset
                </option>
                {state.devices.map((d, i) => (
                  <option key={`${d.host}:${d.port}`} value={i}>
                    {d.name} ({d.host})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            Host or IP address
            <input
              className="input input-sm"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="frame.local"
              spellCheck={false}
            />
          </label>
          <details className="advanced">
            <summary>Service port</summary>
            <input
              className="input input-sm"
              aria-label="Devkit service port"
              type="number"
              min="1"
              max="65535"
              value={port}
              onChange={(event) => setPort(event.target.value)}
            />
          </details>
          <div className="button-row">
            <button
              className="btn btn-sm secondary-button"
              disabled={busy || !host.trim()}
              onClick={() => run(() => window.opendrop.connect(host.trim(), Number(port), true))}
            >
              Pair headset
            </button>
            <button
              className="btn btn-sm secondary-button"
              disabled={busy || !host.trim()}
              onClick={() => run(() => window.opendrop.connect(host.trim(), Number(port), false))}
            >
              Connect
            </button>
          </div>
          <p className="hint">Already paired with OpenDrop? Use Connect.</p>
        </>
      )}
    </section>
  );
}
