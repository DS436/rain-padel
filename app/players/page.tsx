import { PlayersView } from '@/components/PlayersView';
import { AuthGate } from '@/components/AuthGate';

export const metadata = {
  title: 'Players — Rain Padel',
};

export default function PlayersPage() {
  return (
    <AuthGate>
      <PlayersView />
    </AuthGate>
  );
}
