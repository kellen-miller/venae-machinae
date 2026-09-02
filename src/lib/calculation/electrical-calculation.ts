import { evaluateCalculation } from './evaluate-calculation';
import { getFormulaDefinition } from './formula-catalog';

import type { CalculationOutcome, CalculationRequest } from './evaluate-calculation';

export function evaluateElectricalCalculation(
  request: CalculationRequest,
  calculatedAt: string
): CalculationOutcome {
  const definition = getFormulaDefinition(request.formulaId);
  if (definition && definition.domain !== 'electrical') {
    throw new Error(`Formula ${request.formulaId} is not electrical`);
  }

  return evaluateCalculation(request, calculatedAt);
}
