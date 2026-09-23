import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body items-center gap-3 py-10 text-center">
        <div className="rounded-box bg-base-200 p-3">
          <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h2 className="card-title text-base">{title}</h2>
        <p className="max-w-md text-base-content/80">{children}</p>
        {action && <div className="card-actions mt-2">{action}</div>}
      </div>
    </div>
  );
}
