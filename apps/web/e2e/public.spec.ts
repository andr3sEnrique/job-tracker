import { expect, test } from './fixtures';

test('the welcome and privacy pages are public and linked', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('candidaturas');
  await page.getByRole('main').getByRole('link', { name: 'Política de privacidad' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole('heading', { name: 'Uso limitado de los datos de Google' }),
  ).toBeVisible();
  await expect(page.getByText('Limited Use requirements')).toBeVisible();
});

test('pages are served with a nonce CSP and security headers', async ({ request }) => {
  const res = await request.get('/privacy');
  const headers = res.headers();
  expect(headers['content-security-policy']).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-powered-by']).toBeUndefined();
});
