import { Activity, ArrowDownToLine, FlaskConical, Layers, Store } from 'lucide-react';
import type { Appearance } from './useTheme';

export type Page = 'install' | 'library' | 'community-store' | 'activity';
const pages = [
  { id: 'install', label: 'Install', icon: ArrowDownToLine },
  { id: 'library', label: 'Library', icon: Layers },
  { id: 'community-store', label: 'Community Store', icon: Store },
  { id: 'activity', label: 'Activity', icon: Activity },
] as const;

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
    <aside className="flex flex-col gap-6 border-b border-base-300 bg-base-100 p-4 md:fixed md:inset-y-0 md:start-0 md:z-10 md:w-60 md:overflow-y-auto md:border-e md:border-b-0 md:p-5">
      <nav aria-label="Main navigation">
        <ul className="menu grid w-full grid-cols-2 gap-1 p-0 md:flex">
          {pages.map(({ id, label, icon: Icon }) => (
            <li key={id} className="min-w-0">
              <button
                className={`min-h-11 gap-2 px-3 py-3 ${page === id ? 'menu-active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                aria-label={label}
                onClick={() => setPage(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="min-w-0 whitespace-normal">{label}</span>
                {id === 'library' && installed > 0 && (
                  <span className="count badge badge-sm badge-neutral ms-auto tabular-nums">
                    {installed}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid gap-4 sm:grid-cols-2 md:mt-auto md:grid-cols-1 md:pt-8">
        <label className="fieldset p-0 text-sm">
          <span className="label text-base-content/80">Appearance</span>
          <select
            className="select w-full"
            value={appearance}
            onChange={(event) => setAppearance(event.target.value as Appearance)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        <div className="card card-border card-sm bg-base-200">
          <div className="card-body gap-3">
            <label className="flex cursor-pointer items-center gap-2" htmlFor="test-mode">
              <FlaskConical size={16} aria-hidden="true" />
              <span className="font-medium">Test mode</span>
              <input
                id="test-mode"
                type="checkbox"
                role="switch"
                checked={demo}
                className="toggle toggle-primary toggle-sm ms-auto shrink-0"
                disabled={disabled}
                onChange={toggleMode}
              />
            </label>
          </div>
        </div>
        <div className="version hidden flex-wrap justify-between gap-2 px-1 text-xs text-base-content/80 md:flex">
          <span>0.1.0</span>
          <span>Early access</span>
        </div>
      </div>
    </aside>
  );
}
