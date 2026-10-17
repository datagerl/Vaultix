import { test as base, expect, type Page } from '@playwright/test';
import { MockApi, fakeAccessToken } from './mock-api';
import { installFakeFreighter } from './fake-freighter';

/** Must match `use.baseURL` in playwright.config.ts. */
export const APP_ORIGIN = 'http://localhost:3000';

type Fixtures = {
  /** Fresh mocked backend for this test. */
  api: MockApi;
  /** Install the fake Freighter extension for `publicKey` (call before navigating). */
  useFreighter: (publicKey: string, options?: { rejectSignMessage?: boolean }) => Promise<void>;
  /** Start already signed in as `publicKey`, skipping the login UI (covered by its own test). */
  signInAs: (publicKey: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    const api = new MockApi(APP_ORIGIN);
    await api.install(page);
    await use(api);

    // Any write the mock did not recognise means the UI and the API contract
    // have drifted; fail loudly rather than letting the test pass by accident.
    const unexpectedWrites = api.unhandled.filter((c) => c.method !== 'GET');
    expect(unexpectedWrites, 'unmocked API writes').toEqual([]);
  },

  useFreighter: async ({ page }, use) => {
    await use((publicKey, options) => installFakeFreighter(page, { publicKey, ...options }));
  },

  signInAs: async ({ page, context, useFreighter }, use) => {
    await use(async (publicKey: string) => {
      await useFreighter(publicKey);
      const accessToken = fakeAccessToken(publicKey);
      await context.addCookies([{ name: 'vaultix_token', value: accessToken, url: APP_ORIGIN }]);
      await page.addInitScript(
        ({ token, wallet }) => {
          localStorage.setItem('vaultix_token', token);
          localStorage.setItem('vaultix_refresh_token', 'e2e-refresh-token');
          localStorage.setItem('vaultix_session_wallet', wallet);
          localStorage.setItem(
            'vaultix_connected_wallets',
            JSON.stringify([{ publicKey: wallet, walletType: 'freighter', network: 'testnet' }]),
          );
        },
        { token: accessToken, wallet: publicKey },
      );
    });
  },
});

export { expect };

/** App toasts render as `role="alert"`; returns the one containing `text`. */
export function toast(page: Page, text: string | RegExp) {
  return page.getByRole('alert').filter({ hasText: text });
}
