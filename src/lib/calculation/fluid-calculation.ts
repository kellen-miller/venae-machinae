import { evaluateCalculation } from './evaluate-calculation';
import { getFormulaDefinition } from './formula-catalog';

import type { CalculationOutcome, CalculationRequest } from './evaluate-calculation';

export function evaluateFluidCalculation(
  request: CalculationRequest,
  calculatedAt: string
): CalculationOutcome {
  const definition = getFormulaDefinition(request.formulaId);
  if (definition && definition.domain !== 'fluid') {
    throw new Error(`Formula ${request.formulaId} is not fluid`);
  }

  return evaluateCalculation(request, calculatedAt);
}
