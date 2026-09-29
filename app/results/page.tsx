import { AuthGate } from '@/components/AuthGate';
import { ResultsView } from '@/components/ResultsView';

/**
 * The all-time board, opened from the "Top of the board" card on the
 * dashboard. Signed-in only, like the squad it is folded out of.
 */
export const metadata = {
  title: 'Results — Rain Padel',
};

export default function ResultsPage() {
  return (
    <AuthGate>
      <ResultsView />
    </AuthGate>
  );
}
