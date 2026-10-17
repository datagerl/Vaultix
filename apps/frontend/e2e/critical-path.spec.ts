import { test, expect, toast } from './support/fixtures';
import { BUYER, SELLER, buildEscrow } from './support/mock-api';

/**
 * Critical-path E2E: login, create escrow, fund, release, open dispute.
 *
 * Every network call is served by the in-memory MockApi (e2e/support), and the
 * wallet is a fake Freighter extension, so these runs are deterministic and
 * need neither a backend nor the Stellar network.
 */

test.describe('Login', () => {
  test('a wallet sign-in unlocks the protected page the user asked for', async ({ page, api, useFreighter }) => {
    api.seed(buildEscrow({ title: 'Existing escrow' }));
    await useFreighter(BUYER);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/\?returnTo=%2Fdashboard$/);

    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    const freighter = page.getByRole('button', { name: /Freighter/ });
    await expect(freighter).toContainText('Ready');
    await freighter.click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Existing escrow')).toBeVisible();

    expect(api.callsTo('POST', '/auth/challenge')[0].body).toEqual({ walletAddress: BUYER });
    const verify = api.callsTo('POST', '/auth/verify')[0].body as Record<string, string>;
    expect(verify.publicKey).toBe(BUYER);
    expect(verify.signature).toMatch(/^[0-9a-f]{128}$/);

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'vaultix_token')?.value).toBeTruthy();
  });

  test('declining the sign-in request keeps the user signed out', async ({ page, api, useFreighter }) => {
    await useFreighter(BUYER, { rejectSignMessage: true });

    await page.goto('/?returnTo=%2Fdashboard');
    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    const freighter = page.getByRole('button', { name: /Freighter/ });
    await expect(freighter).toContainText('Ready');
    await freighter.click();

    await expect(page.getByText(/Sign-in failed/)).toBeVisible();
    expect(api.callsTo('POST', '/auth/verify')).toHaveLength(0);
    await expect(page).toHaveURL(/returnTo=%2Fdashboard/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/\?returnTo=%2Fdashboard$/);
  });
});

test.describe('Create escrow', () => {
  test('the wizard creates, signs and confirms an escrow', async ({ page, api, signInAs }) => {
    await signInAs(BUYER);
    await page.goto('/escrow/create');

    await expect(page.getByRole('heading', { name: 'Choose a Template' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Title').fill('Mobile app MVP');
    await page.getByLabel('Category').selectOption('service');
    await page.getByLabel('Description').fill('Build and ship the first version of the mobile app.');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Counterparty Address').fill(SELLER);
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Amount').fill('1500');
    await page.getByLabel('Deadline').fill('2030-06-01T12:00');
    await page.getByRole('button', { name: 'Next' }).click();

    // Milestones and conditions are optional.
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Regression: "Next" on the last step used to submit the form, skipping Review.
    await expect(page.getByRole('heading', { name: 'Review & Confirm' })).toBeVisible();
    expect(api.callsTo('POST', '/escrows/creation-intents')).toHaveLength(0);
    await page.getByRole('button', { name: 'Create Escrow' }).click();

    await expect(page.getByRole('heading', { name: 'Escrow Created Successfully!' })).toBeVisible();

    const intent = api.callsTo('POST', '/escrows/creation-intents')[0].body as Record<string, unknown>;
    expect(intent).toMatchObject({
      title: 'Mobile app MVP',
      category: 'service',
      amount: '1500',
      asset: 'XLM',
      counterpartyAddress: SELLER,
    });
    const submit = api.callsTo('POST', /^\/escrows\/creation-intents\/.+\/submit$/)[0];
    expect(submit.path).toContain(String(intent.intentId));
    expect(submit.body).toEqual({ signedXdr: expect.stringContaining('signed-by-e2e') });
    expect([...api.escrows.values()].map((e) => e.title)).toContain('Mobile app MVP');
  });
});

test.describe('Fund escrow', () => {
  test('the buyer funds a pending escrow', async ({ page, api, signInAs }) => {
    const escrow = buildEscrow({ id: 'esc_fund', status: 'pending', amount: '250' });
    api.seed(escrow);
    await signInAs(BUYER);

    await page.goto(`/escrow/${escrow.id}`);
    await expect(page.getByTestId('escrow-status')).toHaveText('Pending');

    await page.getByRole('button', { name: 'Fund Escrow' }).click();

    await expect(toast(page, 'Escrow funded')).toBeVisible();
    await expect(page.getByTestId('escrow-status')).toHaveText('Active');
    await expect(page.getByRole('button', { name: 'Fund Escrow' })).toHaveCount(0);
    expect(api.callsTo('POST', '/escrows/esc_fund/fund')[0].body).toEqual({ amount: '250' });
  });

  test('the seller is never offered fund or release actions', async ({ page, api, signInAs }) => {
    api.seed(buildEscrow({ id: 'esc_seller', status: 'pending' }));
    await signInAs(SELLER);

    await page.goto('/escrow/esc_seller');
    await expect(page.getByRole('heading', { level: 1, name: 'Website redesign' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Fund Escrow' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Release Funds', exact: true })).toHaveCount(0);
  });
});

test.describe('Release funds', () => {
  test('the buyer reviews, confirms and releases an active escrow', async ({ page, api, signInAs }) => {
    api.seed(buildEscrow({ id: 'esc_release', status: 'active', amount: '1000' }));
    await signInAs(BUYER);

    await page.goto('/escrow/esc_release');
    await expect(page.getByTestId('escrow-status')).toHaveText('Active');

    // Page action "Release Funds" opens the modal; the modal's own primary
    // button is "Release funds", so names are matched exactly.
    await page.getByRole('button', { name: 'Release Funds', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Release escrowed funds' })).toBeVisible();
    await expect(page.getByText('995.00 XLM')).toBeVisible(); // 1000 minus the 0.5% fee

    await page.getByRole('button', { name: 'Release funds', exact: true }).click();
    await expect(page.getByText('Confirm on-chain release')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm release', exact: true }).click();

    await expect(page.getByText('Funds successfully released')).toBeVisible();
    await expect(page.getByText('tx_release_e2e')).toBeVisible();

    await page.getByText('Close', { exact: true }).click(); // footer button, not the icon
    await expect(page.getByTestId('escrow-status')).toHaveText('Completed');
    expect(api.callsTo('POST', '/escrows/esc_release/release')).toHaveLength(1);
  });
});

test.describe('Open dispute', () => {
  test('a party files a dispute and the escrow is frozen', async ({ page, api, signInAs }) => {
    api.seed(buildEscrow({ id: 'esc_dispute', status: 'active' }));
    await signInAs(BUYER);

    await page.goto('/escrow/esc_dispute');
    await page.getByRole('button', { name: 'File Dispute' }).click();

    const dialog = page.getByRole('dialog', { name: 'Raise a Dispute' });
    await expect(dialog).toBeVisible();
    await dialog.getByText('Select reason').click();
    await dialog.getByText('Delivery Issue').click();
    await dialog.getByText('Select severity').click();
    await dialog.getByText('High - Critical Issue').click();
    await dialog.getByPlaceholder('Provide detailed explanation of the issue...').fill('Nothing was delivered by the deadline.');
    await dialog.getByRole('button', { name: 'Submit Dispute' }).click();

    const confirm = page.getByRole('dialog', { name: 'Confirm Dispute Filing' });
    await confirm.getByRole('button', { name: 'Confirm & File Dispute' }).click();

    await expect(toast(page, 'Dispute filed successfully')).toBeVisible();
    await expect(page.getByTestId('escrow-status')).toHaveText('Disputed');
    await expect(page.getByRole('button', { name: 'File Dispute' })).toHaveCount(0);
    expect(api.callsTo('POST', '/escrows/esc_dispute/dispute')[0].body).toEqual({ reason: 'DELIVERY_ISSUE' });
  });
});
