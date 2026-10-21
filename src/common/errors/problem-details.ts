import type { FieldIssue } from './app-error';
import { PROBLEM_CODES, type ProblemCode } from './problem-code';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
export const PROBLEM_TYPE_BASE = 'https://jaga-klaim.local/errors';

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly code: ProblemCode;
  readonly trace_id: string;
  readonly errors?: readonly FieldIssue[];
}

export interface ProblemInput {
  readonly code: ProblemCode;
  readonly detail: string;
  readonly traceId: string;
  readonly instance?: string;
  readonly status?: number;
  readonly issues?: readonly FieldIssue[];
}

export function problemTypeUri(slug: string): string {
  return `${PROBLEM_TYPE_BASE}/${slug}`;
}

export function buildProblemDetails(input: ProblemInput): ProblemDetails {
  const definition = PROBLEM_CODES[input.code];

  return {
    type: problemTypeUri(definition.slug),
    title: definition.title,
    status: input.status ?? definition.status,
    detail: input.detail,
    code: input.code,
    trace_id: input.traceId,
    ...(input.instance === undefined ? {} : { instance: input.instance }),
    ...(input.issues === undefined || input.issues.length === 0 ? {} : { errors: input.issues }),
  };
}