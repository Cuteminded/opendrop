import { Store } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { PageHeading } from './PageHeading';

export function CommunityStore() {
  return (
    <>
      <PageHeading title="Community Store" />
      <EmptyState icon={Store} title="Under development">
        The Community Store is still being built and is not available yet.
      </EmptyState>
    </>
  );
}
