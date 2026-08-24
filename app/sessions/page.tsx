import { AuthGate } from '@/components/AuthGate';
import { Dashboard } from '@/components/Dashboard';
import { fetchNews } from '@/lib/news';

/**
 * The landing page for a signed-in organiser.
 *
 * A server component purely so the headlines can be fetched and cached here
 * rather than from the browser — the rest of the screen needs the session
 * store, which is client-side, so `Dashboard` is a client island underneath.
 *
 * The revalidate window has to be a literal (Next reads segment config
 * statically), so it is deliberately the same hour as `NEWS_REVALIDATE_SECONDS`
 * in `lib/news.ts`, which caches the fetch itself.
 */
export const revalidate = 3600;

export const metadata = {
  title: 'Your padel — Rain Padel',
};

export default async function DashboardPage() {
  const { items, fetchedAt } = await fetchNews(4);

  return (
    <AuthGate>
      <Dashboard news={items} newsFetchedAt={fetchedAt} />
    </AuthGate>
  );
}
