import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { MAX_AGE, MIN_AGE } from "./age";
import { dbUserToDomain, dbDate } from "./db-mappers";
import { prisma } from "./db";
import type { AgeBand, PublicUser, Role, User } from "./types";

export { publicDisplayName } from "./format";

/** D2: a Drop under 18 is shown by name but never linked to their profile. */
export function canLinkPublicProfile(person: {
  role?: Role;
  ageBand?: AgeBand;
}): boolean {
  return !(person.role === "drop" && person.ageBand === "13-17");
}

export { MAX_AGE, MIN_AGE } from "./age";

/** The product does not admit children under 13 (see plan/PROFILES.md). */
export function isValidAge(age: number): boolean {
  return Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE;
}

/** Maps an exact age to the only age information ever shown publicly. */
export function ageBand(age: number): AgeBand {
  if (age <= 17) return "13-17";
  if (age <= 29) return "18-29";
  if (age <= 44) return "30-44";
  if (age <= 59) return "45-59";
  if (age <= 74) return "60-74";
  return "75+";
}

/** Strips exact age and any future private fields before crossing the wire. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    ageBand: ageBand(user.age),
    bio: user.bio,
    interests: user.interests,
    createdAt: user.createdAt,
  };
}

export async function getUser(id: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? dbUserToDomain(row) : null;
}

export async function listUsers(): Promise<User[]> {
  const rows = await prisma.user.findMany();
  return rows.map(dbUserToDomain);
}

export async function createUser(input: {
  role: Role;
  name: string;
  age: number;
  bio?: string;
  interests?: string[];
}): Promise<User> {
  const row = await prisma.user.create({
    data: {
      id: `u-${randomUUID()}`,
      role: input.role,
      name: input.name.trim(),
      age: input.age,
      bio: input.bio?.trim() ?? "",
      interests: input.interests ?? [],
    },
  });
  return dbUserToDomain(row);
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const data: Prisma.UserUncheckedUpdateInput = {};
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.age !== undefined) data.age = patch.age;
  if (patch.bio !== undefined) data.bio = patch.bio;
  if (patch.interests !== undefined) data.interests = patch.interests;
  if (patch.createdAt !== undefined) data.createdAt = dbDate(patch.createdAt) ?? new Date();

  try {
    const row = await prisma.user.update({ where: { id }, data });
    return dbUserToDomain(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

/**
 * Resolves the display authors for a page in one pass. Missing/null ids are
 * skipped so legacy seed content can render as "HistorAI community".
 */
export async function getPublicUserMap(
  ids: (string | null | undefined)[],
): Promise<Record<string, PublicUser>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return {};

  const rows = await prisma.user.findMany({ where: { id: { in: wanted } } });
  const map: Record<string, PublicUser> = {};
  for (const row of rows) {
    map[row.id] = toPublicUser(dbUserToDomain(row));
  }
  return map;
}
