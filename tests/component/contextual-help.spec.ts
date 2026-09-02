// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ContextualHelp from '../../src/lib/presentation/help/ContextualHelp.svelte';

describe('MVP-UX-013 contextual engineering help', () => {
  it.each([
    ['electrical-connection', 'Electrical Port', 'Wire'],
    ['fluid-connection', 'Fluid Port', 'Fluid Line']
  ] as const)(
    'links %s fields to canonical bounded guidance',
    async (topic, portTerm, lineTerm) => {
      const user = userEvent.setup();
      render(ContextualHelp, { props: { topic } });

      const trigger = screen.getByRole('button', { name: `Help for ${lineTerm}` });
      await user.click(trigger);

      const dialog = screen.getByRole('dialog', { name: `${lineTerm} help` });
      expect(within(dialog).getByRole('heading', { name: lineTerm })).toBeVisible();
      expect(within(dialog).getByText(portTerm, { exact: true })).toBeVisible();
      expect(dialog).toHaveTextContent('provenance');
      expect(dialog).toHaveTextContent('Unknown');
      expect(dialog).toHaveTextContent('applicability');
      expect(dialog).toHaveTextContent('Validation Rule');
      expect(dialog).toHaveTextContent('Corrective review');
      expect(dialog).not.toHaveTextContent(/recommended|safe|suitable|certified/i);

      await user.click(within(dialog).getByRole('button', { name: 'Close help' }));
      expect(dialog).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    }
  );
});
