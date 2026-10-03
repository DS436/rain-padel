/**
 * Who can sign in, and as whom.
 *
 * SERVER-ONLY data: the addresses come from env vars that are deliberately not
 * `NEXT_PUBLIC_`, and only the names ever leave `/api/login`. The login screen
 * shows the names as a picker and posts the chosen one back with the password.
 *
 *   LOGIN_ACCOUNTS=Devansh:you@example.com,Rahul:rahul@example.com
 *
 * `LOGIN_EMAIL` on its own is the one-account setup from before, and still
 * works: the picker simply does not appear.
 */

export interface LoginAccount {
  name: string;
  email: string;
}

export function parseAccounts(list?: string, single?: string): LoginAccount[] {
  const accounts: LoginAccount[] = [];
  for (const entry of (list ?? '').split(',')) {
    const at = entry.indexOf(':');
    if (at < 0) continue;
    const name = entry.slice(0, at).trim();
    const email = entry.slice(at + 1).trim();
    if (!name || !email) continue;
    // The first spelling of a name wins; a duplicate would make the picker
    // show two buttons that sign into one account.
    if (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) continue;
    accounts.push({ name, email });
  }
  if (accounts.length > 0) return accounts;

  const email = (single ?? '').trim();
  return email ? [{ name: 'Organiser', email }] : [];
}

/**
 * The account a sign-in is for. With a single account the name is optional,
 * so a login screen that never fetched the list still works.
 */
export function pickAccount(accounts: LoginAccount[], name?: string): LoginAccount | null {
  const wanted = (name ?? '').trim().toLowerCase();
  if (!wanted) return accounts.length === 1 ? accounts[0]! : null;
  return accounts.find((a) => a.name.toLowerCase() === wanted) ?? null;
}
