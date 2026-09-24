import { expect, test } from './fixtures';

test('the dashboard shows the summary of the search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Actividad reciente')).toBeVisible();
});

test('clicking a status bar opens the applications with that status', async ({ page }) => {
  await page.goto('/');
  const chart = page.locator('[data-slot="card"]', { hasText: 'Distribución por estado' });
  const bar = chart.locator('.recharts-bar-rectangle path').first();
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page).toHaveURL(/\/applications\?status=[A-Z]+$/);
  await expect(page.getByRole('heading', { name: 'Candidaturas' })).toBeVisible();
});

test('emails can be filtered to data-consent requests', async ({ page }) => {
  await page.goto('/emails?tab=data');
  await expect(page.getByRole('tab', { name: 'Tus datos' })).toHaveAttribute(
    'data-state',
    'active',
  );
});

test('applications can be searched', async ({ page }) => {
  await page.goto('/applications');
  await expect(page.getByRole('heading', { name: 'Candidaturas' })).toBeVisible();
  // Rows come from the client-side API: once they are there, the page is hydrated and the
  // search box reacts to typing.
  await expect(
    page.locator('a[href^="/applications/"]:not([href$="/new"]):visible').first(),
  ).toBeVisible();
  const search = page
    .getByRole('searchbox', { name: 'Buscar candidaturas' })
    .or(page.getByRole('textbox', { name: 'Buscar candidaturas' }));
  await search.fill('zzz-no-match');
  await expect(page).toHaveURL(/q=zzz-no-match/);
  await expect(page.getByText(/ninguna candidatura|sin resultados|no hay/i).first()).toBeVisible();
});

test('a new application can be created and appears in its detail page', async ({ page }) => {
  await page.goto('/applications/new');
  await page.getByLabel('Empresa *').fill('Playwright Labs');
  await page.getByLabel('Puesto *').fill('QA Automation Engineer');
  await page.getByRole('button', { name: 'Crear candidatura' }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
  await expect(page.getByText('QA Automation Engineer').first()).toBeVisible();
  await expect(page.getByText('Playwright Labs').first()).toBeVisible();
});

test('settings show Gmail, AI and account deletion', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('Clasificación con IA')).toBeVisible();
  await expect(page.getByText('claude-haiku-4-5')).toBeVisible();
  await page.getByRole('button', { name: 'Borrar cuenta y datos' }).click();
  const confirm = page.getByRole('button', { name: 'Borrar definitivamente' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
  await expect(confirm).toBeEnabled();
  await page.getByRole('button', { name: 'Cancelar' }).click();
});
