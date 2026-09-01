export const NUMERIC_GOLDENS = Object.freeze({
  conversions: [
    {
      decimal: '25.4',
      from: 'millimetre',
      to: 'inch',
      expected: '1'
    },
    {
      decimal: '1250',
      from: 'milliampere',
      to: 'ampere',
      expected: '1.25'
    },
    {
      decimal: '2.75',
      from: 'kilopascal',
      to: 'pascal',
      expected: '2750'
    }
  ],
  voltageDrop: {
    formulaId: 'electrical.voltage-drop.v1',
    inputs: {
      current: '12.5',
      resistance: '0.032'
    },
    expected: {
      decimal: '0.4',
      unit: 'volt'
    }
  },
  voltageDropBounds: {
    formulaId: 'electrical.voltage-drop.v1',
    inputs: {
      current: { lower: '10', upper: '15' },
      resistance: { lower: '0.02', upper: '0.04' }
    },
    expected: {
      status: 'complete',
      lower: '0.2',
      upper: '0.6',
      method: 'input-bound envelope'
    }
  },
  unsupportedBounds: {
    formulaId: 'electrical.power.v1',
    inputs: {
      voltage: { lower: '-1', upper: '14' },
      current: { lower: '-2', upper: '20' }
    },
    expected: {
      status: 'unknown',
      reason: 'unsupported'
    }
  },
  missingBounds: {
    formulaId: 'electrical.voltage-drop.v1',
    inputs: {
      current: { lower: '10', upper: '15' },
      resistance: { lower: '0.02' }
    },
    expected: {
      status: 'unknown',
      reason: 'missing-bound'
    }
  },
  presentation: {
    decimal: '12.3456',
    significantFigures: 4,
    expected: {
      display: '12.35',
      unrounded: '12.3456',
      significantFigures: 4
    }
  }
} as const);
