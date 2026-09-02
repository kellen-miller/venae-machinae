import { REVIEW_PROFILE_IDS } from './finding';

import type { ReviewProfileId, ValidationScope } from './finding';

export type ValidationRule = Readonly<{
  id: string;
  revision: number;
  title: string;
  evaluation: 'incremental' | 'completeness';
  minimumProfile: ReviewProfileId;
  defaultSeverity: 'blocker' | 'warning' | 'caution' | 'information';
  affectedOperation: string;
}>;

export const VALIDATION_RULES: readonly ValidationRule[] = [
  {
    id: 'topology.interface-conflict',
    revision: 1,
    title: 'Direct interface conflict',
    evaluation: 'incremental',
    minimumProfile: 'topology-review',
    defaultSeverity: 'warning',
    affectedOperation: 'connection authoring'
  },
  {
    id: 'evidence.conflicting',
    revision: 1,
    title: 'Conflicting explicit evidence',
    evaluation: 'incremental',
    minimumProfile: 'topology-review',
    defaultSeverity: 'warning',
    affectedOperation: 'evidence-backed evaluation'
  },
  {
    id: 'calculation.request-input',
    revision: 1,
    title: 'Requested calculation input',
    evaluation: 'incremental',
    minimumProfile: 'engineering-review',
    defaultSeverity: 'blocker',
    affectedOperation: 'requested calculation'
  },
  {
    id: 'screen.configured',
    revision: 1,
    title: 'Configured candidate screen',
    evaluation: 'incremental',
    minimumProfile: 'engineering-review',
    defaultSeverity: 'information',
    affectedOperation: 'configured candidate screen'
  },
  {
    id: 'topology.interface-known',
    revision: 1,
    title: 'Topology interface evidence',
    evaluation: 'completeness',
    minimumProfile: 'topology-review',
    defaultSeverity: 'caution',
    affectedOperation: 'Topology Review'
  },
  {
    id: 'engineering.state-evidence',
    revision: 1,
    title: 'Operating State evidence',
    evaluation: 'completeness',
    minimumProfile: 'engineering-review',
    defaultSeverity: 'caution',
    affectedOperation: 'Engineering Review'
  },
  {
    id: 'build.route-defined',
    revision: 1,
    title: 'Build Route evidence',
    evaluation: 'completeness',
    minimumProfile: 'build-preparation',
    defaultSeverity: 'caution',
    affectedOperation: 'Build Preparation'
  },
  {
    id: 'as-built.subject-evidence',
    revision: 1,
    title: 'As-built subject evidence',
    evaluation: 'completeness',
    minimumProfile: 'as-built-review',
    defaultSeverity: 'caution',
    affectedOperation: 'As-Built Review'
  }
];

export type ReviewProfile = Readonly<{
  id: ReviewProfileId;
  revision: number;
  label: string;
  description: string;
}>;

export const REVIEW_PROFILES: readonly ReviewProfile[] = [
  {
    id: 'topology-review',
    revision: 1,
    label: 'Topology Review',
    description: 'Explicit topology and interface evidence.'
  },
  {
    id: 'engineering-review',
    revision: 1,
    label: 'Engineering Review',
    description: 'Topology plus configured calculations, screens, and Operating State evidence.'
  },
  {
    id: 'build-preparation',
    revision: 1,
    label: 'Build Preparation',
    description: 'Engineering review plus explicit physical Route evidence.'
  },
  {
    id: 'as-built-review',
    revision: 1,
    label: 'As-Built Review',
    description: 'Build preparation plus explicit as-built subject evidence.'
  }
];

const profileRank = new Map(REVIEW_PROFILE_IDS.map((id, index) => [id, index]));

export function rulesForReviewProfile(profileId: ReviewProfileId): readonly string[] {
  const selectedRank = profileRank.get(profileId);
  if (selectedRank === undefined) return [];
  return VALIDATION_RULES.filter(
    (rule) => (profileRank.get(rule.minimumProfile) ?? Number.POSITIVE_INFINITY) <= selectedRank
  ).map((rule) => rule.id);
}

export function validationRulesForScope(scope: ValidationScope): readonly ValidationRule[] {
  if (scope.kind === 'incremental') {
    return VALIDATION_RULES.filter((rule) => rule.evaluation === 'incremental');
  }
  const profileId = scope.kind === 'validate-project' ? 'as-built-review' : scope.profileId;
  const selected = new Set(rulesForReviewProfile(profileId));
  return VALIDATION_RULES.filter((rule) => selected.has(rule.id));
}

export function validationRule(ruleId: string): ValidationRule | null {
  return VALIDATION_RULES.find((rule) => rule.id === ruleId) ?? null;
}
