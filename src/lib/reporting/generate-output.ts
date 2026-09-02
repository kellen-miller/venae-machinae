import { aggregateProjectBom } from '../build/build-record';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../persistence/project-document';

import type { BomLine } from '../build/build-record';
import type { ProjectDocument } from '../persistence/project-document';
import type { ProjectSnapshot } from '../project/project';
import type { Finding, ValidationCoverage } from '../validation/finding';
import type { OverlayChannel } from '../operating-state/operating-state';

export type OutputRevisionSource = 'durable' | 'transient-review' | 'unsaved-working-state';
export type ProjectOutputKind = 'print' | 'csv' | 'zip' | 'validation' | 'project-json';

export type OutputContext = Readonly<{
  source: OutputRevisionSource;
  generatedAt: string;
  view: string;
  operatingStateId: string | null;
  domainFilter: 'all' | 'electrical' | 'fluid';
  systemFilterId: string | null;
  overlayChannels: readonly OverlayChannel[];
  legend: readonly string[];
  pagination: string;
}>;

export type CapturedOutputRevision = Readonly<{
  document: ProjectDocument;
  context: OutputContext;
}>;

export type OutputMetadata = Readonly<{
  projectId: string;
  projectName: string;
  projectRevision: number;
  revisionState: 'Durable revision' | 'Transient review' | 'Unsaved working state';
  view: string;
  operatingState: Readonly<{ id: string; name: string }> | null;
  filters: Readonly<{ domain: 'all' | 'electrical' | 'fluid'; systemId: string | null }>;
  overlayChannels: readonly OverlayChannel[];
  unitSystem: 'metric' | 'imperial';
  legend: readonly string[];
  provenanceSummary: readonly string[];
  generatedAt: string;
  pagination: string;
}>;

export type PrintableReport = Readonly<{
  metadata: OutputMetadata;
  visibleFindings: readonly Finding[];
  bom: readonly BomLine[];
}>;

export function captureOutputRevision(
  snapshot: ProjectSnapshot,
  context: OutputContext
): CapturedOutputRevision {
  if (!Number.isFinite(Date.parse(context.generatedAt))) {
    throw new Error('Output generation time must be an ISO date-time');
  }
  const document = projectSnapshotToDocument(snapshot);
  const capturedContext: OutputContext = {
    source: context.source,
    generatedAt: context.generatedAt,
    view: context.view,
    operatingStateId: context.operatingStateId,
    domainFilter: context.domainFilter,
    systemFilterId: context.systemFilterId,
    overlayChannels: [...context.overlayChannels],
    legend: [...context.legend],
    pagination: context.pagination
  };
  return Object.freeze({
    document: freezeOutputValue(document),
    context: freezeOutputValue(capturedContext)
  });
}

export function createPrintableReport(output: CapturedOutputRevision): PrintableReport {
  const snapshot = projectDocumentToSnapshot(output.document);
  const findings = validationFindings(output.document).filter(
    (finding) => finding.lifecycle === 'active'
  );
  const provenanceSummary = new Set<string>();
  for (const provenance of [
    ...output.document.partDefinitions.map((definition) => definition.provenance),
    ...output.document.evidence.map((evidence) => evidence.provenance),
    ...output.document.engineeringValues.map((value) => value.provenance),
    ...output.document.build.procurementChoices.map((choice) => choice.provenance),
    ...output.document.build.installations.map((installation) => installation.provenance)
  ]) {
    if (provenance) provenanceSummary.add(provenance);
  }
  const operatingState = output.context.operatingStateId
    ? (output.document.operatingStates.find(
        (state) => state.id === output.context.operatingStateId
      ) ?? null)
    : null;
  const domains = output.context.domainFilter === 'all' ? undefined : [output.context.domainFilter];
  const systemIds = output.context.systemFilterId ? [output.context.systemFilterId] : undefined;

  return Object.freeze({
    metadata: Object.freeze({
      projectId: output.document.project.id,
      projectName: output.document.project.name,
      projectRevision: output.document.project.revision,
      revisionState: revisionStateLabel(output.context.source),
      view: output.context.view,
      operatingState: operatingState
        ? Object.freeze({ id: operatingState.id, name: operatingState.name })
        : null,
      filters: Object.freeze({
        domain: output.context.domainFilter,
        systemId: output.context.systemFilterId
      }),
      overlayChannels: Object.freeze([...output.context.overlayChannels]),
      unitSystem: output.document.settings.unitSystem,
      legend: Object.freeze([...output.context.legend]),
      provenanceSummary: Object.freeze([...provenanceSummary].toSorted()),
      generatedAt: output.context.generatedAt,
      pagination: output.context.pagination
    }),
    visibleFindings: Object.freeze(
      findings.toSorted((left, right) => left.id.localeCompare(right.id))
    ),
    bom: Object.freeze(
      aggregateProjectBom(snapshot, {
        ...(domains ? { domains } : {}),
        ...(systemIds ? { systemIds } : {})
      })
    )
  });
}

type CsvRaw = Readonly<{ raw: string }>;
type CsvCell = string | CsvRaw;
type CsvTable = Readonly<{
  columns: readonly string[];
  rows: readonly (readonly CsvCell[])[];
}>;

const raw = (value: string | number): CsvRaw => ({ raw: String(value) });

export function createCsvTables(output: CapturedOutputRevision): Readonly<Record<string, string>> {
  const print = createPrintableReport(output);
  const findings = validationFindings(output.document);
  const definitionProvenance = new Map(
    output.document.partDefinitions.map((definition) => [definition.id, definition.provenance])
  );
  const tables: Record<string, CsvTable> = {
    'bom.csv': {
      columns: [
        'bom_id',
        'part_definition_id',
        'part_label',
        'variant',
        'raw_value',
        'unit',
        'provenance',
        'status',
        'consuming_subject_ids',
        'domains',
        'system_ids'
      ],
      rows: print.bom.map((line) => [
        line.id,
        line.partDefinitionId,
        line.label,
        line.variant,
        raw(line.exactDemand),
        line.unit,
        definitionProvenance.get(line.partDefinitionId) ?? '',
        'design-demand',
        line.consumingSubjectIds.join('|'),
        line.domains.join('|'),
        line.systemIds.join('|')
      ])
    },
    'components.csv': {
      columns: ['component_id', 'label', 'kind', 'x_raw', 'y_raw', 'part_definition_id'],
      rows: output.document.topology.components
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((component) => [
          component.id,
          component.label,
          component.kind,
          raw(component.position.x),
          raw(component.position.y),
          component.definitionId ?? ''
        ])
    },
    'connections.csv': {
      columns: [
        'connection_id',
        'label',
        'domain',
        'system_id',
        'source_port_id',
        'target_port_id',
        'kind',
        'medium_id',
        'route_id',
        'interface_status'
      ],
      rows: output.document.topology.connections
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((connection) => [
          connection.id,
          connection.label,
          connection.domain,
          connection.systemId,
          connection.sourcePortId,
          connection.targetPortId,
          connection.kind,
          connection.mediumId ?? '',
          connection.routeId ?? '',
          connection.interfaceAssessment
        ])
    },
    'electrical-circuits.csv': {
      columns: [
        'circuit_id',
        'label',
        'system_id',
        'connection_ids',
        'component_ids',
        'protection_component_ids'
      ],
      rows: output.document.electrical.circuits
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((circuit) => [
          circuit.id,
          circuit.label,
          circuit.systemId,
          circuit.connectionIds.join('|'),
          circuit.componentIds.join('|'),
          circuit.protectionComponentIds.join('|')
        ])
    },
    'electrical-construction.csv': {
      columns: [
        'record_id',
        'kind',
        'label',
        'component_ids',
        'connection_ids',
        'segment_ids',
        'status'
      ],
      rows: [
        ...output.document.electrical.harnesses.map((harness) => [
          harness.id,
          'harness',
          harness.label,
          harness.componentIds.join('|'),
          harness.wireConnectionIds.join('|'),
          '',
          'recorded'
        ]),
        ...output.document.electrical.bundles.map((bundle) => [
          bundle.id,
          'bundle',
          bundle.label,
          '',
          bundle.wireConnectionIds.join('|'),
          bundle.segmentIds.join('|'),
          'recorded'
        ])
      ].toSorted((left, right) => String(left[0]).localeCompare(String(right[0])))
    },
    'electrical-wires.csv': {
      columns: [
        'connection_id',
        'role',
        'part_definition_id',
        'route_raw_value',
        'route_unit',
        'cut_raw_value',
        'cut_unit',
        'provenance',
        'status'
      ],
      rows: output.document.electrical.wires
        .toSorted((left, right) => left.connectionId.localeCompare(right.connectionId))
        .map((wire) => [
          wire.connectionId,
          wire.role,
          wire.partDefinitionId ?? '',
          wire.routeLength ? raw(wire.routeLength.decimal) : '',
          wire.routeLength?.unit ?? '',
          wire.cutLength ? raw(wire.cutLength.decimal) : '',
          wire.cutLength?.unit ?? '',
          wire.cutLength?.provenance ?? wire.routeLength?.provenance ?? '',
          wire.cutLength || wire.routeLength ? 'known' : 'unknown'
        ])
    },
    'evidence.csv': {
      columns: [
        'evidence_id',
        'subject_id',
        'label',
        'raw_value',
        'unit',
        'provenance',
        'status',
        'conflict_values'
      ],
      rows: output.document.evidence
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((evidence) => [
          evidence.id,
          evidence.subjectId,
          evidence.label,
          evidence.value && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(evidence.value)
            ? raw(evidence.value)
            : (evidence.value ?? ''),
          evidence.unit ?? '',
          evidence.provenance ?? '',
          evidence.state,
          evidence.conflictValues.join('|')
        ])
    },
    'findings.csv': {
      columns: [
        'finding_id',
        'rule_id',
        'rule_revision',
        'subject_id',
        'claim',
        'severity',
        'evaluation_status',
        'lifecycle_status',
        'disposition_status',
        'provenance'
      ],
      rows: findings.map((finding) => [
        finding.id,
        finding.ruleId,
        raw(finding.ruleRevision),
        finding.subjectId,
        finding.claim,
        finding.severity,
        finding.evaluation,
        finding.lifecycle,
        finding.disposition.kind,
        finding.knownEvidence.join('|')
      ])
    },
    'fluid-interfaces.csv': {
      columns: ['port_id', 'component_id', 'label', 'medium_id', 'interface_key', 'status'],
      rows: output.document.topology.components
        .flatMap((component) => component.ports)
        .filter((port) => port.domain === 'fluid')
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((port) => [
          port.id,
          port.componentId,
          port.label,
          port.mediumId ?? '',
          port.interfaceKey ?? '',
          port.interfaceKey ? 'known' : 'unknown'
        ])
    },
    'fluid-lines.csv': {
      columns: [
        'connection_id',
        'construction',
        'part_definition_id',
        'route_raw_value',
        'route_unit',
        'hydraulic_raw_value',
        'hydraulic_unit',
        'cut_raw_value',
        'cut_unit',
        'provenance',
        'status'
      ],
      rows: output.document.fluid.lines
        .toSorted((left, right) => left.connectionId.localeCompare(right.connectionId))
        .map((line) => [
          line.connectionId,
          line.construction.kind,
          line.partDefinitionId ?? '',
          line.routeLength ? raw(line.routeLength.decimal) : '',
          line.routeLength?.unit ?? '',
          line.hydraulicLength ? raw(line.hydraulicLength.decimal) : '',
          line.hydraulicLength?.unit ?? '',
          line.cutLength ? raw(line.cutLength.decimal) : '',
          line.cutLength?.unit ?? '',
          line.provenance,
          line.routeLength || line.hydraulicLength || line.cutLength ? 'known' : 'unknown'
        ])
    },
    'installations.csv': {
      columns: [
        'installation_id',
        'subject_id',
        'part_definition_id',
        'variant',
        'raw_value',
        'unit',
        'provenance',
        'status',
        'measured_evidence_ids',
        'observation_evidence_ids',
        'photo_asset_hashes',
        'notes',
        'recorded_at'
      ],
      rows: output.document.build.installations
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((installation) => [
          installation.id,
          installation.subjectId,
          installation.installedPartDefinitionId ?? '',
          installation.installedVariant ?? '',
          raw(installation.quantity),
          installation.unit,
          installation.provenance,
          installation.status,
          installation.measuredEvidenceIds.join('|'),
          installation.observationEvidenceIds.join('|'),
          installation.photoAssetHashes.join('|'),
          installation.notes,
          installation.recordedAt
        ])
    },
    'metadata.csv': {
      columns: ['field', 'value'],
      rows: [
        ['project_id', output.document.project.id],
        ['project_name', output.document.project.name],
        ['project_revision', raw(output.document.project.revision)],
        ['revision_state', revisionStateLabel(output.context.source)],
        ['generated_at', output.context.generatedAt],
        ['view', output.context.view],
        ['operating_state_id', output.context.operatingStateId ?? ''],
        ['domain_filter', output.context.domainFilter],
        ['system_filter_id', output.context.systemFilterId ?? ''],
        ['overlay_channels', output.context.overlayChannels.join('|')],
        ['unit_system', output.document.settings.unitSystem]
      ]
    },
    'ports.csv': {
      columns: [
        'port_id',
        'component_id',
        'label',
        'domain',
        'medium_id',
        'interface_key',
        'status'
      ],
      rows: output.document.topology.components
        .flatMap((component) => component.ports)
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((port) => [
          port.id,
          port.componentId,
          port.label,
          port.domain,
          port.mediumId ?? '',
          port.interfaceKey ?? '',
          port.interfaceKey ? 'known' : 'unknown'
        ])
    },
    'procurement.csv': {
      columns: [
        'choice_id',
        'part_definition_id',
        'variant',
        'purchased_raw_value',
        'unit',
        'method',
        'package_size_raw_value',
        'spare_percent_raw_value',
        'waste_raw_value',
        'consumable_raw_value',
        'provenance',
        'note'
      ],
      rows: output.document.build.procurementChoices
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((choice) => [
          choice.id,
          choice.partDefinitionId,
          choice.variant,
          raw(choice.purchasedQuantity),
          choice.unit,
          choice.method,
          choice.packageSize ? raw(choice.packageSize) : '',
          choice.sparePercent ? raw(choice.sparePercent) : '',
          choice.wasteQuantity ? raw(choice.wasteQuantity) : '',
          choice.consumableQuantity ? raw(choice.consumableQuantity) : '',
          choice.provenance,
          choice.note
        ])
    },
    'results.csv': {
      columns: [
        'result_id',
        'kind',
        'source_revision',
        'status',
        'detail_type',
        'subject_id',
        'operating_state_id',
        'formula_id',
        'formula_revision',
        'outcome_status',
        'completeness',
        'raw_value',
        'unit',
        'classification',
        'bounds_lower_raw_value',
        'bounds_upper_raw_value',
        'reason',
        'omissions',
        'assumptions',
        'applicability',
        'screening_candidates'
      ],
      rows: output.document.results
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((result): CsvCell[] => {
          const calculation = result.detail?.type === 'calculation' ? result.detail.outcome : null;
          const calculationOutput = calculation?.output ?? null;
          const screening = result.detail?.type === 'screening' ? result.detail.result : null;
          return [
            result.id,
            result.kind,
            raw(result.sourceRevision),
            result.status,
            result.detail?.type ?? '',
            calculation?.trace.subjectId ?? screening?.subjectId ?? '',
            calculation?.trace.operatingStateId ?? screening?.operatingStateId ?? '',
            calculation?.trace.formulaId ?? '',
            calculation?.trace.formulaRevision === null ||
            calculation?.trace.formulaRevision === undefined
              ? ''
              : raw(calculation.trace.formulaRevision),
            calculation?.status ?? '',
            calculation?.completeness ?? '',
            calculationOutput?.kind === 'quantity' ? raw(calculationOutput.decimal) : '',
            calculationOutput?.kind === 'quantity' ? calculationOutput.unit : '',
            calculationOutput?.kind === 'classification' ? calculationOutput.value : '',
            calculation?.bounds ? raw(calculation.bounds.lower) : '',
            calculation?.bounds ? raw(calculation.bounds.upper) : '',
            calculation?.reason ?? '',
            calculation?.omissions.join('|') ?? '',
            calculation?.trace.assumptions.join('|') ?? '',
            calculation?.trace.applicability.join('|') ?? '',
            screening?.candidates
              .map(
                (candidate) =>
                  `${candidate.label}:${candidate.comparisons
                    .map(
                      (comparison) =>
                        `${comparison.criterionId}=${comparison.outcome}${comparison.reason ? `(${comparison.reason})` : ''}`
                    )
                    .join(';')}`
              )
              .join('|') ?? ''
          ];
        })
    },
    'routes.csv': {
      columns: [
        'route_id',
        'segment_id',
        'segment_order',
        'label',
        'start_x_raw',
        'start_y_raw',
        'end_x_raw',
        'end_y_raw',
        'status'
      ],
      rows: output.document.topology.routes.flatMap((route) =>
        route.segmentIds.map((segmentId, index) => {
          const segment = output.document.topology.segments.find(
            (candidate) => candidate.id === segmentId
          );
          return [
            route.id,
            segmentId,
            raw(index + 1),
            segment?.label ?? '',
            segment ? raw(segment.start.x) : '',
            segment ? raw(segment.start.y) : '',
            segment ? raw(segment.end.x) : '',
            segment ? raw(segment.end.y) : '',
            segment ? 'known' : 'unknown'
          ];
        })
      )
    },
    'systems.csv': {
      columns: ['system_id', 'label', 'domain', 'medium_id'],
      rows: output.document.topology.systems
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((system) => [system.id, system.label, system.domain, system.mediumId ?? ''])
    }
  };

  return Object.freeze(
    Object.fromEntries(
      Object.entries(tables)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([filename, table]) => [
          filename,
          encodeCsv(
            filename === 'metadata.csv'
              ? table
              : {
                  columns: ['project_revision', 'generated_at', ...table.columns],
                  rows: table.rows.map((row) => [
                    raw(output.document.project.revision),
                    output.context.generatedAt,
                    ...row
                  ])
                }
          )
        ])
    )
  );
}

export type ValidationReport = Readonly<{
  projectId: string;
  projectRevision: number;
  revisionState: 'Durable revision' | 'Transient review' | 'Unsaved working state';
  runScopes: readonly string[];
  reviewProfiles: readonly string[];
  operatingStateIds: readonly string[];
  filters: Readonly<{ domain: 'all' | 'electrical' | 'fluid'; systemId: string | null }>;
  ruleRevisions: readonly Readonly<{ ruleId: string; revision: number }>[];
  coverage: readonly Readonly<{ runId: string; coverage: ValidationCoverage | null }>[];
  generatedAt: string;
  findings: readonly Readonly<{
    id: string;
    lifecycleLabel: string;
    finding: Finding;
  }>[];
}>;

export function createValidationReport(
  output: CapturedOutputRevision,
  options: Readonly<{ includeResolved?: boolean }> = {}
): ValidationReport {
  const histories = output.document.results.flatMap((result) =>
    result.detail?.type === 'validation' ? [result.detail.history] : []
  );
  const runs = histories
    .flatMap((history) => history.runs)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const findings = histories
    .flatMap((history) => history.findings)
    .filter((finding) => options.includeResolved || finding.lifecycle === 'active')
    .toSorted((left, right) => {
      if (left.lifecycle !== right.lifecycle) return left.lifecycle === 'active' ? -1 : 1;
      return left.id.localeCompare(right.id);
    });
  const ruleRevisions = new Map<string, number>();
  for (const finding of histories.flatMap((history) => history.findings)) {
    ruleRevisions.set(finding.ruleId, finding.ruleRevision);
  }

  return Object.freeze({
    projectId: output.document.project.id,
    projectRevision: output.document.project.revision,
    revisionState: revisionStateLabel(output.context.source),
    runScopes: Object.freeze([...new Set(runs.map((run) => run.scopeKey))].toSorted()),
    reviewProfiles: Object.freeze(
      [...new Set(runs.flatMap((run) => (run.profileId ? [run.profileId] : [])))].toSorted()
    ),
    operatingStateIds: Object.freeze(
      output.document.operatingStates.map((state) => state.id).toSorted()
    ),
    filters: Object.freeze({
      domain: output.context.domainFilter,
      systemId: output.context.systemFilterId
    }),
    ruleRevisions: Object.freeze(
      [...ruleRevisions]
        .map(([ruleId, revision]) => Object.freeze({ ruleId, revision }))
        .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId))
    ),
    coverage: Object.freeze(
      runs.map((run) => Object.freeze({ runId: run.id, coverage: run.coverage }))
    ),
    generatedAt: output.context.generatedAt,
    findings: Object.freeze(
      findings.map((finding) =>
        Object.freeze({
          id: finding.id,
          lifecycleLabel:
            finding.lifecycle === 'resolved' ? 'Resolved' : `Active · ${finding.disposition.kind}`,
          finding
        })
      )
    )
  });
}

export function createExportAllZip(output: CapturedOutputRevision): Uint8Array {
  const encoder = new TextEncoder();
  const files = Object.entries(createCsvTables(output)).map(([name, contents]) => ({
    name,
    bytes: encoder.encode(contents)
  }));
  files.push({
    name: 'manifest.json',
    bytes: encoder.encode(
      JSON.stringify(
        {
          format: 'venae-derived-output',
          roundTrip: false,
          projectId: output.document.project.id,
          projectRevision: output.document.project.revision,
          revisionState: revisionStateLabel(output.context.source),
          generatedAt: output.context.generatedAt,
          tables: files.map((file) => file.name).toSorted()
        },
        null,
        2
      )
    )
  });
  files.sort((left, right) => left.name.localeCompare(right.name));
  return encodeStoredZip(files, output.context.generatedAt);
}

function validationFindings(document: ProjectDocument): Finding[] {
  return document.results
    .flatMap((result) =>
      result.detail?.type === 'validation' ? result.detail.history.findings : []
    )
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

function revisionStateLabel(
  source: OutputRevisionSource
): 'Durable revision' | 'Transient review' | 'Unsaved working state' {
  if (source === 'durable') return 'Durable revision';
  if (source === 'transient-review') return 'Transient review';
  return 'Unsaved working state';
}

function encodeCsv(table: CsvTable): string {
  const rows = [table.columns, ...table.rows];
  return `${rows.map((row) => row.map(encodeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function encodeCsvCell(cell: CsvCell): string {
  const value = typeof cell === 'string' ? neutralizeSpreadsheetText(cell) : cell.raw;
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function neutralizeSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function freezeOutputValue<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeOutputValue(child);
    Object.freeze(value);
  }
  return value;
}

function encodeStoredZip(
  files: readonly Readonly<{ name: string; bytes: Uint8Array }>[],
  generatedAt: string
): Uint8Array {
  const encoder = new TextEncoder();
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;
  const { time, date } = dosDateTime(generatedAt);

  for (const file of files) {
    const name = encoder.encode(file.name);
    const checksum = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length + file.bytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(file.bytes, 30 + name.length);
    localRecords.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralRecords.push(central);
    localOffset += local.length;
  }

  const centralOffset = localOffset;
  const centralSize = centralRecords.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  const archive = new Uint8Array(centralOffset + centralSize + end.length);
  let offset = 0;
  for (const record of [...localRecords, ...centralRecords, end]) {
    archive.set(record, offset);
    offset += record.length;
  }
  return archive;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: string): Readonly<{ time: number; date: number }> {
  const instant = new Date(value);
  const year = Math.max(1980, instant.getUTCFullYear());
  return {
    time:
      (instant.getUTCHours() << 11) |
      (instant.getUTCMinutes() << 5) |
      Math.floor(instant.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((instant.getUTCMonth() + 1) << 5) | instant.getUTCDate()
  };
}
