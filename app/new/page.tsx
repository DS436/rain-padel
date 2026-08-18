import { Suspense } from 'react';
import { NewSessionForm } from '@/components/NewSessionForm';
import { AuthGate } from '@/components/AuthGate';

export default function NewTournamentPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="p-8 text-ink-faint">Loading…</div>}>
        <NewSessionForm />
      </Suspense>
    </AuthGate>
  );
}
