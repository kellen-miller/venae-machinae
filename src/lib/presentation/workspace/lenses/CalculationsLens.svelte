<script lang="ts">
  import {
    getFormulaDefinition,
    listFormulaDefinitions
  } from '../../../calculation/formula-catalog';
  import {
    baseUnitForSemantic,
    unitSemantic,
    unitsForSemantic
  } from '../../../calculation/unit-registry';
  import { createOperatingState } from '../../../operating-state/operating-state';

  import type { FormulaId } from '../../../calculation/formula-catalog';
  import type { SemanticQuantity, UnitId } from '../../../calculation/unit-registry';
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';

  let {
    snapshot,
    canAuthor,
    onaction
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  const formulas = listFormulaDefinitions();
  const subjects = $derived([
    { id: snapshot.id, label: `${snapshot.name} · Project` },
    ...snapshot.topology.systems.map((system) => ({
      id: system.id,
      label: `${system.label} · System`
    })),
    ...snapshot.topology.components.map((component) => ({
      id: component.id,
      label: `${component.label} · Component`
    })),
    ...snapshot.topology.connections.map((connection) => ({
      id: connection.id,
      label: `${connection.label} · Connection`
    }))
  ]);
  const calculationResults = $derived(
    snapshot.results.filter((result) => result.detail?.type === 'calculation')
  );
  const screeningResults = $derived(
    snapshot.results.filter((result) => result.detail?.type === 'screening')
  );

  let stateName = $state('');
  let stateDescription = $state('');
  let calculationId = $state('');
  let formulaId = $state<FormulaId>('electrical.voltage-drop.v1');
  let calculationSubjectId = $state('');
  let calculationStateId = $state('');
  let calculationPathId = $state('');
  let inputValues = $state<Record<string, string>>({});
  let inputUnits = $state<Record<string, UnitId>>({});
  let inputLowerBounds = $state<Record<string, string>>({});
  let inputUpperBounds = $state<Record<string, string>>({});
  let inputUncertainties = $state<Record<string, string>>({});
  let variableInputValues = $state('');
  let assumptions = $state('steady DC');
  let omissions = $state('');
  let currentClass = $state('continuous');
  let fluidSteady = $state('true');
  let fluidPhase = $state('single');
  let fluidCompressibility = $state('incompressible');
  let fluidBehavior = $state('Newtonian');

  let screeningId = $state('');
  let screeningSubjectId = $state('');
  let screeningStateId = $state('');
  let minimumWorkingPressure = $state('150');
  let selectedCandidates = $state<Record<string, boolean>>({});
  let candidateWorkingPressures = $state<Record<string, string>>({});

  const selectedFormula = $derived(getFormulaDefinition(formulaId));
  const selectedCalculationSubjectId = $derived(calculationSubjectId || snapshot.id);
  const selectedScreeningSubjectId = $derived(screeningSubjectId || snapshot.id);

  function splitEntries(value: string): string[] {
    return value
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function humanize(value: string): string {
    return value.replaceAll('-', ' ');
  }

  function inputUnit(name: string, semantic: SemanticQuantity): UnitId {
    const chosen = inputUnits[name];
    return chosen && unitSemantic(chosen) === semantic ? chosen : baseUnitForSemantic(semantic);
  }

  function addOperatingState(): void {
    if (!stateName.trim()) return;
    const stateId = crypto.randomUUID();
    if (
      onaction({
        type: 'add-operating-state',
        causationId: crypto.randomUUID(),
        state: createOperatingState({
          id: stateId,
          name: stateName.trim(),
          description: stateDescription.trim()
        })
      })
    ) {
      calculationStateId = stateId;
      screeningStateId = stateId;
      stateName = '';
      stateDescription = '';
    }
  }

  function configureCalculation(): void {
    if (!selectedFormula || !calculationStateId) return;
    if (
      selectedFormula.inputs.some(
        (input) =>
          Boolean(inputLowerBounds[input.name]?.trim()) !==
          Boolean(inputUpperBounds[input.name]?.trim())
      )
    ) {
      return;
    }
    const id = calculationId || crypto.randomUUID();
    const state = snapshot.operatingStates.find((candidate) => candidate.id === calculationStateId);
    const assumptionEntries = splitEntries(assumptions);
    const inputs = selectedFormula.inputs.flatMap((input) => {
      const decimal = inputValues[input.name]?.trim();
      if (!decimal) return [];
      const unit = inputUnit(input.name, input.semantic);
      const lower = inputLowerBounds[input.name]?.trim();
      const upper = inputUpperBounds[input.name]?.trim();
      const uncertainty = inputUncertainties[input.name]?.trim();
      return [
        {
          name: input.name,
          quantity: {
            id: `${id}:input:${input.name}`,
            semantic: input.semantic,
            decimal,
            unit,
            applicability: [state?.name, ...assumptionEntries].filter(Boolean).join('; '),
            uncertainty: uncertainty ? { decimal: uncertainty, unit } : null,
            bounds: lower && upper ? { lower, upper } : null,
            origin: 'entered' as const,
            provenance: 'user-entered calculation input'
          }
        }
      ];
    });
    if (selectedFormula.variableInputPrefix && selectedFormula.output) {
      for (const [index, decimal] of splitEntries(variableInputValues).entries()) {
        inputs.push({
          name: `${selectedFormula.variableInputPrefix}${index + 1}`,
          quantity: {
            id: `${id}:input:${selectedFormula.variableInputPrefix}${index + 1}`,
            semantic: selectedFormula.output.semantic,
            decimal,
            unit: selectedFormula.output.baseUnit,
            applicability: [state?.name, ...assumptionEntries].filter(Boolean).join('; '),
            uncertainty: null,
            bounds: null,
            origin: 'entered',
            provenance: 'user-entered calculation input'
          }
        });
      }
    }
    const accepted = onaction({
      type: 'configure-calculation',
      causationId: crypto.randomUUID(),
      calculation: {
        id,
        subjectId: selectedCalculationSubjectId,
        operatingStateId: calculationStateId,
        formulaId: selectedFormula.id,
        pathId: calculationPathId || null,
        inputs,
        assumptions: assumptionEntries,
        conditions:
          selectedFormula.domain === 'electrical'
            ? { currentClass }
            : {
                steady: fluidSteady,
                phase: fluidPhase,
                compressibility: fluidCompressibility,
                fluidBehavior
              },
        omissions: splitEntries(omissions),
        desiredOutputUnit: selectedFormula.output?.baseUnit ?? null
      }
    });
    if (accepted) calculationId = id;
  }

  function configureScreening(): void {
    const chosen = snapshot.partDefinitions.filter(
      (definition) => selectedCandidates[definition.id]
    );
    if (!screeningStateId || !minimumWorkingPressure.trim() || chosen.length === 0) return;
    const id = screeningId || crypto.randomUUID();
    const accepted = onaction({
      type: 'configure-screening',
      causationId: crypto.randomUUID(),
      screening: {
        id,
        subjectId: selectedScreeningSubjectId,
        operatingStateId: screeningStateId,
        criteria: [
          {
            id: `${id}:criterion:working-pressure`,
            label: 'Minimum working pressure',
            evidenceKey: 'working-pressure',
            applicability: 'applicable',
            comparison: {
              kind: 'at-least',
              limit: {
                id: `${id}:limit:working-pressure`,
                semantic: 'pressure-gauge',
                decimal: minimumWorkingPressure.trim(),
                unit: 'kilopascal-gauge',
                applicability: 'selected Operating State',
                uncertainty: null,
                bounds: null,
                origin: 'entered',
                provenance: 'user-entered screening criterion'
              }
            }
          }
        ],
        selectedCandidates: chosen.map((definition) => {
          const pressure = candidateWorkingPressures[definition.id]?.trim();
          return {
            id: definition.id,
            label: definition.label,
            evidence: {
              'working-pressure': pressure
                ? {
                    kind: 'quantity' as const,
                    quantity: {
                      id: `${id}:candidate:${definition.id}:working-pressure`,
                      semantic: 'pressure-gauge' as const,
                      decimal: pressure,
                      unit: 'kilopascal-gauge' as const,
                      applicability: 'selected Operating State',
                      uncertainty: null,
                      bounds: null,
                      origin: 'sourced' as const,
                      provenance: definition.provenance
                    }
                  }
                : null
            }
          };
        })
      }
    });
    if (accepted) screeningId = id;
  }
</script>

<section class="calculations-lens">
  <header>
    <div>
      <p>Bounded evidence-bearing outcomes</p>
      <h2>Calculations</h2>
    </div>
    <span>{snapshot.calculations.length} configured · {snapshot.screenings.length} screens</span>
  </header>

  <details open>
    <summary>Operating context</summary>
    <div class="authoring-grid state-grid">
      <label>
        <span>Operating State name</span>
        <input bind:value={stateName} disabled={!canAuthor} />
      </label>
      <label>
        <span>Operating State description</span>
        <input bind:value={stateDescription} disabled={!canAuthor} />
      </label>
      <button type="button" disabled={!canAuthor || !stateName.trim()} onclick={addOperatingState}>
        Add Operating State
      </button>
    </div>
    <ul class="state-register">
      {#each snapshot.operatingStates as state (state.id)}
        <li><strong>{state.name}</strong><span>{state.description || 'No description'}</span></li>
      {:else}
        <li><strong>No Operating State</strong><span>Every evaluation requires one.</span></li>
      {/each}
    </ul>
  </details>

  <details open>
    <summary>Evaluate a versioned formula</summary>
    <div class="authoring-grid calculation-grid">
      <label class="wide">
        <span>Formula</span>
        <select bind:value={formulaId} disabled={!canAuthor}>
          {#each formulas as formula (formula.id)}
            <option value={formula.id}>{humanize(formula.id.replace('.v1', ''))}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Subject</span>
        <select bind:value={calculationSubjectId} disabled={!canAuthor}>
          {#each subjects as subject (subject.id)}
            <option value={subject.id}>{subject.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Operating State</span>
        <select bind:value={calculationStateId} disabled={!canAuthor}>
          <option value="">Choose Operating State</option>
          {#each snapshot.operatingStates as state (state.id)}
            <option value={state.id}>{state.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Route context</span>
        <select bind:value={calculationPathId} disabled={!canAuthor}>
          <option value="">No Route context</option>
          {#each snapshot.topology.routes as route (route.id)}
            <option value={route.id}>{route.id}</option>
          {/each}
        </select>
      </label>
      {#if selectedFormula}
        {#each selectedFormula.inputs as input (input.name)}
          <fieldset class="input-block wide">
            <legend>{humanize(input.name)}</legend>
            <div class="input-row">
              <label>
                <span>Value</span>
                <input
                  aria-label={`${input.name} value`}
                  inputmode="decimal"
                  value={inputValues[input.name] ?? ''}
                  disabled={!canAuthor}
                  oninput={(event) => (inputValues[input.name] = event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Unit</span>
                <select
                  aria-label={`${input.name} unit`}
                  value={inputUnit(input.name, input.semantic)}
                  disabled={!canAuthor}
                  onchange={(event) =>
                    (inputUnits[input.name] = event.currentTarget.value as UnitId)}
                >
                  {#each unitsForSemantic(input.semantic) as unit (unit)}
                    <option value={unit}>{humanize(unit)}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span>Lower bound</span>
                <input
                  aria-label={`${input.name} lower bound`}
                  inputmode="decimal"
                  value={inputLowerBounds[input.name] ?? ''}
                  disabled={!canAuthor}
                  oninput={(event) => (inputLowerBounds[input.name] = event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Upper bound</span>
                <input
                  aria-label={`${input.name} upper bound`}
                  inputmode="decimal"
                  value={inputUpperBounds[input.name] ?? ''}
                  disabled={!canAuthor}
                  oninput={(event) => (inputUpperBounds[input.name] = event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Uncertainty</span>
                <input
                  aria-label={`${input.name} uncertainty`}
                  inputmode="decimal"
                  value={inputUncertainties[input.name] ?? ''}
                  disabled={!canAuthor}
                  oninput={(event) => (inputUncertainties[input.name] = event.currentTarget.value)}
                />
              </label>
            </div>
          </fieldset>
        {/each}
        {#if selectedFormula.variableInputPrefix && selectedFormula.output}
          <label class="wide">
            <span>{humanize(selectedFormula.variableInputPrefix)} terms</span>
            <input
              bind:value={variableInputValues}
              disabled={!canAuthor}
              placeholder={`Semicolon-separated ${humanize(selectedFormula.output.baseUnit)} values`}
            />
          </label>
        {/if}
      {/if}
      <label class="wide">
        <span>Assumptions</span>
        <input
          bind:value={assumptions}
          disabled={!canAuthor}
          placeholder="Separate with semicolons"
        />
      </label>
      <label class="wide">
        <span>Omissions</span>
        <input
          bind:value={omissions}
          disabled={!canAuthor}
          placeholder="Separate with semicolons"
        />
      </label>
      {#if selectedFormula?.domain === 'electrical'}
        <label>
          <span>Current class</span>
          <select bind:value={currentClass} disabled={!canAuthor}>
            <option value="continuous">Continuous</option>
            <option value="intermittent">Intermittent</option>
            <option value="startup">Startup</option>
            <option value="stall">Stall</option>
            <option value="measured-operating-point">Measured operating point</option>
          </select>
        </label>
      {:else}
        <label>
          <span>Steady</span>
          <select bind:value={fluidSteady} disabled={!canAuthor}>
            <option value="true">Steady</option><option value="false">Unsteady</option>
          </select>
        </label>
        <label>
          <span>Phase</span>
          <select bind:value={fluidPhase} disabled={!canAuthor}>
            <option value="single">Single phase</option><option value="two-phase">Two phase</option>
          </select>
        </label>
        <label>
          <span>Compressibility</span>
          <select bind:value={fluidCompressibility} disabled={!canAuthor}>
            <option value="incompressible">Incompressible</option>
            <option value="compressible">Compressible</option>
          </select>
        </label>
        <label>
          <span>Fluid behavior</span>
          <select bind:value={fluidBehavior} disabled={!canAuthor}>
            <option value="Newtonian">Newtonian</option>
            <option value="non-Newtonian">Non-Newtonian</option>
          </select>
        </label>
      {/if}
      <button
        type="button"
        disabled={!canAuthor || !calculationStateId}
        onclick={configureCalculation}
      >
        Evaluate Calculation
      </button>
    </div>
    <p class="boundary-note">
      Empty inputs produce Unknown. Electrical authority stops above 60 V DC; fluid authority is
      steady, single-phase, incompressible, and Newtonian where the formula requires it.
    </p>
  </details>

  <section class="result-section" aria-label="Calculation outcomes">
    <h3>Calculation outcomes</h3>
    <div class="result-grid">
      {#each calculationResults as result (result.id)}
        {@const outcome = result.detail?.type === 'calculation' ? result.detail.outcome : null}
        {#if outcome}
          <article data-calculation-result data-status={outcome.status}>
            <div class="result-heading">
              <strong
                >{outcome.status === 'calculated' ? 'Calculated' : humanize(outcome.status)}</strong
              >
              <span>{humanize(outcome.completeness)}</span>
            </div>
            {#if outcome.output?.kind === 'quantity'}
              <output>{outcome.output.decimal} {humanize(outcome.output.unit)}</output>
            {:else if outcome.output?.kind === 'classification'}
              <output>{outcome.output.value}</output>
            {:else}
              <output>{humanize(outcome.reason ?? 'no result')}</output>
            {/if}
            <small>{outcome.trace.formulaId} · r{outcome.trace.formulaRevision ?? '—'}</small>
            {#if outcome.bounds}
              <p>{outcome.bounds.lower}–{outcome.bounds.upper} · {outcome.bounds.method}</p>
            {/if}
            {#if outcome.omissions.length > 0}
              <p>Omissions: {outcome.omissions.join('; ')}</p>
            {/if}
            <p>Inputs: {outcome.trace.inputIds.join(', ') || 'none'}</p>
          </article>
        {/if}
      {:else}
        <p class="empty-result">No calculation result. Missing inputs remain Unknown.</p>
      {/each}
    </div>
  </section>

  <details open>
    <summary>Screen selected candidates</summary>
    <div class="authoring-grid screening-grid">
      <label>
        <span>Screening subject</span>
        <select bind:value={screeningSubjectId} disabled={!canAuthor}>
          {#each subjects as subject (subject.id)}
            <option value={subject.id}>{subject.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Screening Operating State</span>
        <select
          aria-label="Screening Operating State"
          bind:value={screeningStateId}
          disabled={!canAuthor}
        >
          <option value="">Choose Operating State</option>
          {#each snapshot.operatingStates as state (state.id)}
            <option value={state.id}>{state.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Minimum working pressure</span>
        <input
          aria-label="Minimum working pressure"
          inputmode="decimal"
          bind:value={minimumWorkingPressure}
          disabled={!canAuthor}
        />
      </label>
      <span class="unit-suffix">kilopascal gauge</span>
      <fieldset class="wide">
        <legend>Selected Part Definitions</legend>
        {#each snapshot.partDefinitions as definition (definition.id)}
          <div class="candidate-row">
            <label class="candidate-choice">
              <input
                type="checkbox"
                aria-label={definition.label}
                checked={selectedCandidates[definition.id] ?? false}
                disabled={!canAuthor}
                onchange={(event) =>
                  (selectedCandidates[definition.id] = event.currentTarget.checked)}
              />
              <span>{definition.label}</span>
            </label>
            <label>
              <span>Working pressure · kPa gauge</span>
              <input
                aria-label={`${definition.label} working pressure`}
                inputmode="decimal"
                value={candidateWorkingPressures[definition.id] ?? ''}
                disabled={!canAuthor || !selectedCandidates[definition.id]}
                oninput={(event) =>
                  (candidateWorkingPressures[definition.id] = event.currentTarget.value)}
              />
            </label>
          </div>
        {:else}
          <p>Add project-local Part Definitions in the Interfaces view.</p>
        {/each}
      </fieldset>
      <button
        type="button"
        disabled={!canAuthor ||
          !screeningStateId ||
          !minimumWorkingPressure.trim() ||
          !snapshot.partDefinitions.some((definition) => selectedCandidates[definition.id])}
        onclick={configureScreening}
      >
        Screen Selected Candidates
      </button>
    </div>
    <p class="boundary-note">
      Each comparison stands alone. Missing or conflicting evidence remains visible; this screen
      does not rank, recommend, or declare aggregate suitability.
    </p>
  </details>

  <section class="result-section" aria-label="Candidate screening outcomes">
    <h3>Candidate screening outcomes</h3>
    <div class="result-grid">
      {#each screeningResults as result (result.id)}
        {@const screening = result.detail?.type === 'screening' ? result.detail.result : null}
        {#if screening}
          <article data-screening-result>
            {#each screening.candidates as candidate (candidate.candidateId)}
              <div class="candidate-result">
                <strong>{candidate.label}</strong>
                {#each candidate.comparisons as comparison (comparison.criterionId)}
                  <span data-comparison={comparison.outcome}>
                    {humanize(comparison.outcome)}{comparison.reason
                      ? ` · ${humanize(comparison.reason)}`
                      : ''}
                  </span>
                {/each}
              </div>
            {/each}
          </article>
        {/if}
      {:else}
        <p class="empty-result">No selected-candidate screen has run.</p>
      {/each}
    </div>
  </section>
</section>

<style>
  .calculations-lens {
    display: grid;
    gap: 0.9rem;
    min-width: 0;
    color: #213d3e;
  }

  header,
  .result-heading,
  .candidate-result {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
  }

  header {
    align-items: end;
  }

  header p,
  header span,
  small,
  .boundary-note,
  .unit-suffix {
    margin: 0;
    color: #687a79;
    font: 0.6rem/1.45 var(--font-mono);
    letter-spacing: 0.035em;
  }

  header p,
  header span,
  label > span,
  legend,
  summary,
  h3 {
    text-transform: uppercase;
  }

  h2 {
    margin: 0.12rem 0 0;
    color: #173d3f;
    font: 2rem var(--font-display);
  }

  h3 {
    margin: 0;
    color: #244d4c;
    font: 0.68rem var(--font-mono);
    letter-spacing: 0.08em;
  }

  details,
  .result-section {
    border: 1px solid #cbd8d3;
    background: rgb(249 250 247 / 88%);
  }

  summary {
    padding: 0.7rem 0.8rem;
    color: #244d4c;
    font: 0.67rem var(--font-mono);
    cursor: pointer;
  }

  .authoring-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(10rem, 1fr));
    gap: 0.55rem;
    padding: 0.75rem;
    border-top: 1px solid #d9e2de;
    background: #edf4f0;
  }

  .state-grid {
    grid-template-columns: minmax(10rem, 0.7fr) minmax(14rem, 1.3fr) auto;
  }

  label {
    display: grid;
    gap: 0.24rem;
    min-width: 0;
  }

  label > span,
  legend {
    color: #596e6d;
    font: 0.56rem var(--font-mono);
    letter-spacing: 0.045em;
  }

  input,
  select,
  button {
    min-width: 0;
    min-height: 2.55rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.28rem;
    font: 0.76rem var(--font-mono);
  }

  input,
  select {
    padding: 0.42rem 0.5rem;
    background: #fff;
    color: #243e40;
  }

  button {
    align-self: end;
    padding: 0.48rem 0.75rem;
    background: #234d4c;
    color: #fff;
    cursor: pointer;
  }

  button:disabled,
  input:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .wide,
  fieldset,
  .authoring-grid > button,
  .boundary-note {
    grid-column: 1 / -1;
  }

  .boundary-note {
    padding: 0 0.75rem 0.75rem;
  }

  .state-register {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0 0.75rem 0.75rem;
    list-style: none;
  }

  .state-register li {
    display: grid;
    gap: 0.12rem;
    padding: 0.4rem 0.55rem;
    border-left: 0.22rem solid #c06a3c;
    background: #f2f5f1;
  }

  .state-register strong {
    font: 0.7rem var(--font-mono);
  }

  .state-register span {
    color: #687a79;
    font: 0.58rem var(--font-mono);
  }

  .result-section {
    display: grid;
    gap: 0.55rem;
    padding: 0.75rem;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.55rem;
  }

  article,
  .empty-result {
    margin: 0;
    padding: 0.7rem;
    border: 1px solid #ccd9d4;
    border-radius: 0.45rem 0.12rem 0.45rem 0.12rem;
    background: #fff;
  }

  article[data-status='unknown'],
  article[data-status='unsupported'] {
    border-left: 0.28rem solid #c06a3c;
  }

  .result-heading strong,
  output {
    color: #173d3f;
  }

  .result-heading strong {
    font: 0.72rem var(--font-mono);
    text-transform: uppercase;
  }

  .result-heading span,
  .candidate-result span {
    color: #7a4b34;
    font: 0.6rem var(--font-mono);
  }

  output {
    display: block;
    margin: 0.55rem 0 0.25rem;
    overflow-wrap: anywhere;
    font: 1.15rem var(--font-display);
  }

  article p {
    margin: 0.38rem 0 0;
    color: #586d6c;
    font: 0.62rem/1.45 var(--font-mono);
  }

  fieldset {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0.65rem;
    border: 1px solid #b8c9c3;
  }

  .candidate-row {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) minmax(10rem, 1fr);
    gap: 0.55rem;
    align-items: center;
  }

  .input-block {
    background: rgb(255 255 255 / 55%);
  }

  .input-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(7rem, 1fr));
    gap: 0.45rem;
  }

  .candidate-choice {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .candidate-choice input {
    min-height: 1rem;
  }

  .candidate-result {
    align-items: center;
    padding: 0.38rem 0;
    border-bottom: 1px solid #e0e7e3;
  }

  .candidate-result:last-child {
    border-bottom: 0;
  }

  .candidate-result strong {
    font: 0.7rem var(--font-mono);
  }

  [data-comparison='pass'] {
    color: #31694f;
  }

  [data-comparison='fail'],
  [data-comparison='indeterminate'],
  [data-comparison='unevaluated'] {
    color: #9e4f31;
  }

  @media (max-width: 900px) {
    .state-grid,
    .authoring-grid,
    .candidate-row,
    .input-row {
      grid-template-columns: 1fr;
    }

    .state-grid > button,
    .candidate-row > *,
    .wide,
    fieldset,
    .authoring-grid > button {
      grid-column: 1;
    }
  }
</style>
