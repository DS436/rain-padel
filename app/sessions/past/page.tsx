import { AuthGate } from '@/components/AuthGate';
import { PastSessions } from '@/components/PastSessions';

/**
 * Every night played, with the delete button. Signed-in only, like the
 * dashboard it hangs off — the list is the organiser's, not the group's.
 */
export const metadata = {
  title: 'Past sessions — Rain Padel',
};

export default function PastSessionsPage() {
  return (
    <AuthGate>
      <PastSessions />
    </AuthGate>
  );
}
