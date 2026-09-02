import { expect, test } from '@playwright/test';

test('production shell exposes delivery state without a project endpoint', async ({
  page,
  request
}) => {
  const projectRequests: string[] = [];
  page.on('request', (outgoing) => {
    if (/\/(?:api\/)?projects?(?:\/|\?|$)/.test(new URL(outgoing.url()).pathname)) {
      projectRequests.push(outgoing.url());
    }
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your vehicle systems work stays in this browser.' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blank project' })).toBeEnabled();

  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });

  const version = await request.get('/version');
  expect(version.status()).toBe(200);
  expect(await version.json()).toEqual({ application: '0.1.0' });
  expect(projectRequests).toEqual([]);
});
