import type { Role } from "./types";

export const MIN_AGE = 13;
export const MAX_AGE = 120;
export const RIVER_MIN_AGE = 31;
export const DROP_MIN_AGE = 16;
export const DROP_MAX_AGE = 30;

export interface AgeRange {
  min: number;
  max: number;
}

export function ageRangeForRole(role: Role): AgeRange {
  return role === "drop"
    ? { min: DROP_MIN_AGE, max: DROP_MAX_AGE }
    : { min: RIVER_MIN_AGE, max: MAX_AGE };
}

export function isValidAgeForRole(age: number, role: Role): boolean {
  if (!Number.isInteger(age)) return false;
  const range = ageRangeForRole(role);
  return age >= range.min && age <= range.max;
}

export function ageRequirement(role: Role): string {
  return role === "drop"
    ? `Please enter an age between ${DROP_MIN_AGE} and ${DROP_MAX_AGE}.`
    : `Please enter an age between ${RIVER_MIN_AGE} and ${MAX_AGE}.`;
}
