// @vitest-environment jsdom

import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ApplicationShell from '../../src/routes/+page.svelte';

describe('application shell', () => {
  it('exposes the browser-local authority boundary without enabling mutation', () => {
    render(ApplicationShell);

    expect(
      screen.getByRole('heading', { name: 'Your vehicle systems work stays in this browser.' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Blank project' })).toBeDisabled();
    expect(screen.getByText('Server project data').nextElementSibling).toHaveTextContent('None');
  });
});
