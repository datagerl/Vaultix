import { test, expect } from './support/fixtures';
import { BUYER } from './support/mock-api';

test.describe('WebSocket real-time updates & recovery', () => {
  test('the reconnect banner appears when live updates drop and clears on recovery', async ({ page, api, signInAs }) => {
    await signInAs(BUYER);
    await page.goto('/dashboard');

    const banner = page.getByText(/Reconnecting to live updates/i);
    await expect(page.getByRole('status', { name: 'Live updates connected' })).toBeVisible();
    await expect(banner).toBeHidden();

    api.setSocketOffline(true);
    await expect(banner).toBeVisible();

    api.setSocketOffline(false);
    // socket.io-client retries with backoff; allow a few attempts.
    await expect(banner).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('status', { name: 'Live updates connected' })).toBeVisible();
  });
});
