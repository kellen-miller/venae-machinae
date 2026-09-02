export type HelpTopic = 'electrical-connection' | 'fluid-connection';

export type HelpContent = Readonly<{
  title: 'Wire' | 'Fluid Line';
  portTerm: 'Electrical Port' | 'Fluid Port';
  connectionTerm: 'Connection';
  definition: string;
  portDefinition: string;
  formulaBoundary: string;
  validationBoundary: string;
  provenanceRequirement: string;
  correctiveReview: readonly string[];
}>;

export const HELP_CONTENT: Readonly<Record<HelpTopic, HelpContent>> = {
  'electrical-connection': {
    title: 'Wire',
    portTerm: 'Electrical Port',
    connectionTerm: 'Connection',
    definition:
      'A Wire is one routed Electrical Connection containing one conductive path between two Electrical Ports.',
    portDefinition:
      'An Electrical Port is one independently connectable terminal or pin. Actual direction belongs to an Operating State.',
    formulaBoundary:
      'A formula produces a Calculation Result only from named inputs inside its stated applicability envelope. Unknown input provenance stays Unknown; no hidden default is substituted.',
    validationBoundary:
      'A Validation Rule reports evidence for its named scope and stopping boundary. It does not turn a scoped Finding into a whole-project verdict.',
    provenanceRequirement:
      'Record the value origin, original unit, subject, Operating State when applicable, uncertainty or bounds, and any conflicting source.',
    correctiveReview: [
      'Confirm the two explicit Electrical Ports and their Interface Specifications.',
      'Add or correct the source record instead of overwriting conflicting evidence.',
      'Re-run the scoped calculation and Validation Rule after the evidence changes.'
    ]
  },
  'fluid-connection': {
    title: 'Fluid Line',
    portTerm: 'Fluid Port',
    connectionTerm: 'Connection',
    definition:
      'A Fluid Line is one routed Fluid Connection containing one wetted passage between two Fluid Ports. Its construction is hose, tube, or pipe.',
    portDefinition:
      'A Fluid Port is one independently connectable opening. Actual flow direction belongs to an Operating State and derived Flow Path.',
    formulaBoundary:
      'A formula produces a Calculation Result only for the named Fluid Medium, inputs, and applicability envelope. Missing hydraulic evidence remains Unknown or a known subtotal.',
    validationBoundary:
      'A Validation Rule stops at its declared evidence boundary. Unsupported behavior, omissions, and non-applicable rules remain explicit.',
    provenanceRequirement:
      'Record provenance for the medium and value, including source, original unit, Operating State or boundary context, uncertainty or bounds, and any conflicting measurement.',
    correctiveReview: [
      'Confirm the two explicit Fluid Ports, medium, and Interface Specifications.',
      'Record Hydraulic Length separately from Route Length and Cut Length.',
      'Re-run the scoped calculation and Validation Rule after the evidence changes.'
    ]
  }
};
