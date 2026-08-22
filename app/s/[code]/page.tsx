import { SpectatorView } from '@/components/SpectatorView';

/**
 * The spectator link. No AuthGate: a share code is the whole credential, and
 * the point of it is that eight people can open the scores without any of them
 * having an account.
 */
export const metadata = {
  title: 'Live scores — Rain Padel',
  // A padel scoreboard on someone's phone has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function SharedSessionPage({ params }: PageProps<'/s/[code]'>) {
  const { code } = await params;
  return <SpectatorView code={code} />;
}
