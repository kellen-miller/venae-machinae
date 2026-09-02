// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ApplicationShell from '../../src/routes/+page.svelte';

describe('application shell', () => {
  it('opens the browser-local library before enabling project creation', async () => {
    render(ApplicationShell);

    expect(
      screen.getByRole('heading', { name: 'Your vehicle systems work stays in this browser.' })
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Blank project' })).toBeEnabled();
    });
    expect(screen.getByText('Server project data').nextElementSibling).toHaveTextContent('None');
  });
});
