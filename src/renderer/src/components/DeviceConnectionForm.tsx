import { Search } from 'lucide-react';
import type { AppState } from '../../../shared/types';

export function DeviceConnectionForm({
  devices,
  host,
  setHost,
  port,
  setPort,
  busy,
  run,
}: {
  devices: AppState['devices'];
  host: string;
  setHost: (host: string) => void;
  port: string;
  setPort: (port: string) => void;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  return (
    <>
      <ol className="steps steps-vertical text-start text-xs text-base-content/80">
        <li className="step min-h-12" data-content="1">
          Enable Developer Mode on your Frame.
        </li>
        <li className="step min-h-12" data-content="2">
          Open Developer &gt; Pair new host.
        </li>
        <li className="step min-h-12" data-content="3">
          Keep both devices on the same Wi-Fi.
        </li>
      </ol>
      <button
        className="btn w-full"
        disabled={busy}
        onClick={() => run(() => window.opendrop.discover())}
      >
        <Search size={16} aria-hidden="true" />
        Find headset
      </button>
      {devices.length > 0 && (
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">Discovered devices</span>
          <select
            className="select w-full"
            value=""
            onChange={(event) => {
              const device = devices[Number(event.target.value)];
              setHost(device.host);
              setPort(String(device.port));
            }}
          >
            <option value="" disabled>
              Select a headset
            </option>
            {devices.map((device, i) => (
              <option key={`${device.host}:${device.port}`} value={i}>
                {device.name} ({device.host})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="fieldset p-0 text-sm">
        <span className="label text-base-content/80">Host or IP address</span>
        <input
          className="input w-full"
          value={host}
          onChange={(event) => setHost(event.target.value)}
          placeholder="frame.local"
          spellCheck={false}
        />
      </label>
      <details className="collapse collapse-arrow border border-base-300">
        <summary className="collapse-title text-sm font-medium">Service port</summary>
        <div className="collapse-content">
          <input
            className="input w-full"
            aria-label="Devkit service port"
            type="number"
            min="1"
            max="65535"
            value={port}
            onChange={(event) => setPort(event.target.value)}
          />
        </div>
      </details>
      <div className="card-actions grid grid-cols-2">
        <button
          className="btn w-full px-3"
          disabled={busy || !host.trim()}
          onClick={() => run(() => window.opendrop.connect(host.trim(), Number(port), true))}
        >
          Pair headset
        </button>
        <button
          className="btn w-full px-3"
          disabled={busy || !host.trim()}
          onClick={() => run(() => window.opendrop.connect(host.trim(), Number(port), false))}
        >
          Connect
        </button>
      </div>
      <p className="text-center text-xs text-base-content/80">
        Already paired with OpenDrop? Use Connect.
      </p>
    </>
  );
}
