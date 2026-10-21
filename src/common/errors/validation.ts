import type { ValidationError } from 'class-validator';
import { ValidationFailedError, type FieldIssue } from './app-error';

const MAX_REPORTED_ISSUES = 50;

function toApiFieldName(segment: string): string {
  return segment.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toApiPath(path: string): string {
  return path
    .split('.')
    .map((segment) => (/^\d+$/.test(segment) ? segment : toApiFieldName(segment)))
    .join('.');
}

function collectIssues(errors: readonly ValidationError[], parentPath = ''): FieldIssue[] {
  const issues: FieldIssue[] = [];

  for (const error of errors) {
    const path = parentPath.length === 0 ? error.property : `${parentPath}.${error.property}`;
    const constraints = error.constraints ?? {};

    for (const message of Object.values(constraints)) {
      issues.push({ field: toApiPath(path), message });
    }

    if (error.children !== undefined && error.children.length > 0) {
      issues.push(...collectIssues(error.children, path));
    }
  }

  return issues;
}

export function validationExceptionFactory(errors: ValidationError[]): ValidationFailedError {
  const issues = collectIssues(errors);
  const reported = issues.slice(0, MAX_REPORTED_ISSUES);

  if (issues.length > reported.length) {
    reported.push({
      field: '_',
      message: `Masih ada ${issues.length - reported.length} kesalahan lain yang tidak ditampilkan.`,
    });
  }

  return new ValidationFailedError(reported);
}