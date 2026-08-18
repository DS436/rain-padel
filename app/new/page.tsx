import { Suspense } from 'react';
import { NewSessionForm } from '@/components/NewSessionForm';

export default function NewTournamentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-faint">Loading…</div>}>
      <NewSessionForm />
    </Suspense>
  );
}
