import { Activity, ArrowDownToLine, Box, FlaskConical, Layers } from 'lucide-react';
import type { Appearance } from './useTheme';

export type Page = 'install' | 'library' | 'activity';
export function Sidebar({
  appearance,
  setAppearance,
  page,
  setPage,
  demo,
  disabled,
  installed,
  toggleMode,
}: {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  page: Page;
  setPage: (page: Page) => void;
  demo: boolean;
  disabled: boolean;
  installed: number;
  toggleMode: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Box size={22} strokeWidth={1.6} />
        </div>
        <span>
          opendrop<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav aria-label="Main navigation">
        <ul className="menu menu-md sidebar-menu">
          <li>
            <button
              className={page === 'install' ? 'menu-active' : ''}
              aria-current={page === 'install' ? 'page' : undefined}
              onClick={() => setPage('install')}
            >
              <ArrowDownToLine size={18} />
              Install
            </button>
          </li>
          <li>
            <button
              className={page === 'library' ? 'menu-active' : ''}
              aria-current={page === 'library' ? 'page' : undefined}
              aria-label="Library"
              onClick={() => setPage('library')}
            >
              <Layers size={18} />
              Library{installed > 0 && <span className="badge badge-xs count">{installed}</span>}
            </button>
          </li>
          <li>
            <button
              className={page === 'activity' ? 'menu-active' : ''}
              aria-current={page === 'activity' ? 'page' : undefined}
              onClick={() => setPage('activity')}
            >
              <Activity size={18} />
              Activity
            </button>
          </li>
        </ul>
      </nav>
      <div className="sidebar-bottom">
        <label className="appearance-field">
          Appearance
          <select
            className="select select-sm"
            value={appearance}
            onChange={(event) => setAppearance(event.target.value as Appearance)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        <div className="card card-border mode-card">
          <div>
            <FlaskConical size={16} />
            <label htmlFor="test-mode">Test mode</label>
            <input
              id="test-mode"
              type="checkbox"
              role="switch"
              checked={demo}
              className="toggle toggle-primary toggle-sm"
              disabled={disabled}
              onChange={toggleMode}
            />
          </div>
          <p>{demo ? 'Explore without a headset.' : 'Try OpenDrop without hardware.'}</p>
        </div>
        <div className="open-source">
          <span className="open-dot" />
          Open source<span className="badge badge-xs badge-outline">MIT</span>
        </div>
        <div className="version">
          OpenDrop 0.1.0<span>Early access</span>
        </div>
      </div>
    </aside>
  );
}
