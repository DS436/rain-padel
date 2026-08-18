import { TournamentProvider } from '@/components/TournamentProvider';
import { LiveView } from '@/components/LiveView';

// Next 16 App Router: `params` is a Promise.
export default async function TournamentPage({ params }: PageProps<'/t/[id]'>) {
  const { id } = await params;
  return (
    <TournamentProvider key={id} id={id}>
      <LiveView />
    </TournamentProvider>
  );
}
