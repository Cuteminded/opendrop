import { Store } from 'lucide-react';

export function CommunityStore() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Community Store</h1>
        </div>
      </div>
      <div className="empty-state">
        <Store size={27} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <strong>Under development</strong>
          <p>The Community Store is still being built and is not available yet.</p>
        </div>
      </div>
    </>
  );
}
