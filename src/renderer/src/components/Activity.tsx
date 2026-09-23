import { CircleAlert, Clock, Info } from 'lucide-react';
import type { LogEntry } from '../../../shared/types';
import { EmptyState } from './EmptyState';
import { PageHeading } from './PageHeading';

export function Activity({ logs }: { logs: LogEntry[] }) {
  return (
    <>
      <PageHeading title="Activity">
        Connections, transfers and errors from this session.
      </PageHeading>
      {!logs.length ? (
        <EmptyState icon={Clock} title="No activity yet">
          Connect a headset or choose a build to get started.
        </EmptyState>
      ) : (
        <ul
          className="list rounded-box border border-base-300 bg-base-100"
          aria-label="Session activity"
        >
          {[...logs].reverse().map((log, i) => (
            <li
              className="list-row grid-cols-[auto_minmax(0,1fr)] items-start"
              key={`${log.time}-${i}`}
            >
              {log.level === 'error' ? (
                <CircleAlert size={18} className="mt-1 text-error" aria-label="Error" />
              ) : (
                <Info size={18} className="mt-1" aria-label="Information" />
              )}
              <div className="min-w-0">
                <time
                  className="font-mono text-xs text-base-content/80 tabular-nums"
                  dateTime={log.time}
                >
                  {new Date(log.time).toLocaleTimeString('en-GB')}
                </time>
                <p className={`mt-1 wrap-anywhere ${log.level === 'error' ? 'text-error' : ''}`}>
                  {log.message}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
