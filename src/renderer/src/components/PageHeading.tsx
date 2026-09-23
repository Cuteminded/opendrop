import type { ReactNode } from 'react';

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-2 text-base-content/80">{children}</p>}
    </div>
  );
}
