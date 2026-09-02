import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build } from 'vite';

import { NUMERIC_GOLDENS } from '../fixtures/numeric-goldens';

let browserBundle = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/gates/entries/numeric-browser.ts'),
        formats: ['iife'],
        name: 'VenaeNumericGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  if (outputs.length === 0) {
    throw new Error('Numeric browser build did not return Rollup output');
  }

  const chunk = outputs.flatMap((output) => output.output).find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Numeric browser bundle is absent');
  browserBundle = chunk.code;
});

test('MVP-GATE-007 produces identical numeric display in a production browser', async ({
  page
}) => {
  await page.setContent('<output id="numeric-result"></output>');
  await page.addScriptTag({ content: browserBundle });

  const result = await page.evaluate((goldens) => {
    const numeric = (
      window as unknown as {
        VenaeNumericGate: {
          convertDecimal(decimal: string, from: 'millimetre', to: 'inch'): string;
          evaluateFormula(
            formulaId: 'electrical.voltage-drop.v1',
            inputs: Readonly<Record<string, string>>
          ): { decimal: string; unit: string };
          presentDecimal(
            decimal: string,
            significantFigures: number
          ): { display: string; unrounded: string; significantFigures: number };
        };
      }
    ).VenaeNumericGate;
    const conversion = numeric.convertDecimal(
      goldens.conversions[0].decimal,
      goldens.conversions[0].from,
      goldens.conversions[0].to
    );
    const formula = numeric.evaluateFormula(goldens.voltageDrop.formulaId, {
      ...goldens.voltageDrop.inputs
    });
    const presentation = numeric.presentDecimal(
      goldens.presentation.decimal,
      goldens.presentation.significantFigures
    );
    document.querySelector('#numeric-result')!.textContent = presentation.display;
    return {
      conversion,
      formula,
      presentation,
      rendered: document.querySelector('#numeric-result')!.textContent
    };
  }, NUMERIC_GOLDENS);

  expect(result).toEqual({
    conversion: NUMERIC_GOLDENS.conversions[0].expected,
    formula: NUMERIC_GOLDENS.voltageDrop.expected,
    presentation: NUMERIC_GOLDENS.presentation.expected,
    rendered: NUMERIC_GOLDENS.presentation.expected.display
  });
});
