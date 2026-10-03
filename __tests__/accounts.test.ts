import { describe, expect, it } from 'vitest';
import { parseAccounts, pickAccount } from '@/lib/accounts';

describe('login accounts', () => {
  it('reads a named list, tolerating stray spaces', () => {
    expect(parseAccounts(' Devansh : d@x.com , Rahul:r@x.com ')).toEqual([
      { name: 'Devansh', email: 'd@x.com' },
      { name: 'Rahul', email: 'r@x.com' },
    ]);
  });

  it('skips half-written entries and repeated names', () => {
    expect(parseAccounts('Devansh:d@x.com,Rahul,:a@x.com,devansh:other@x.com')).toEqual([
      { name: 'Devansh', email: 'd@x.com' },
    ]);
  });

  it('falls back to the single LOGIN_EMAIL account', () => {
    expect(parseAccounts(undefined, 'd@x.com')).toEqual([{ name: 'Organiser', email: 'd@x.com' }]);
    expect(parseAccounts('', '')).toEqual([]);
  });

  it('prefers the named list when both are set', () => {
    expect(parseAccounts('Rahul:r@x.com', 'd@x.com')).toEqual([{ name: 'Rahul', email: 'r@x.com' }]);
  });

  it('picks by name, ignoring case', () => {
    const accounts = parseAccounts('Devansh:d@x.com,Rahul:r@x.com');
    expect(pickAccount(accounts, 'rahul')?.email).toBe('r@x.com');
    expect(pickAccount(accounts, 'Nobody')).toBeNull();
  });

  it('needs a name when there is more than one account, and not when there is one', () => {
    expect(pickAccount(parseAccounts('Devansh:d@x.com,Rahul:r@x.com'))).toBeNull();
    expect(pickAccount(parseAccounts(undefined, 'd@x.com'))?.email).toBe('d@x.com');
  });
});
