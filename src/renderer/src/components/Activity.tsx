import { CircleAlert, Clock } from 'lucide-react';
import type { LogEntry } from '../../../shared/types';

export function Activity({ logs }: { logs: LogEntry[] }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Activity</h1>
          <p>Connections, transfers and errors from this session.</p>
        </div>
      </div>
      {!logs.length ? (
        <div className="empty-state">
          <Clock size={27} strokeWidth={1.5} />
          <div>
            <strong>No activity yet</strong>
            <p>Connect a headset or choose a build to get started.</p>
          </div>
        </div>
      ) : (
        <div className="activity-list">
          {[...logs].reverse().map((log, i) => (
            <div className={`log-row ${log.level}`} key={`${log.time}-${i}`}>
              <time dateTime={log.time}>{new Date(log.time).toLocaleTimeString('en-GB')}</time>
              {log.level === 'error' ? (
                <CircleAlert size={15} aria-label="Error" />
              ) : (
                <span className="log-dot" />
              )}
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
