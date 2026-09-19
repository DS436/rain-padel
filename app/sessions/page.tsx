import { AuthGate } from '@/components/AuthGate';
import { Dashboard } from '@/components/Dashboard';

/**
 * The landing page for a signed-in organiser.
 *
 * The redesign took the headlines off this screen — they live on the public
 * landing page, which is where somebody browsing has the patience for them.
 * That leaves nothing here to fetch on the server, so this is just the gate
 * around a client island.
 */
export const metadata = {
  title: 'Your padel — Rain Padel',
};

export default function DashboardPage() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
