import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type { AgeBand, PublicUser, Role, User } from "./types";

interface UsersData {
  users: User[];
}

const USERS_PATH = path.join(process.cwd(), "data", "users.json");
const EMPTY: UsersData = { users: [] };

/** The product does not admit children under 13 (see plan/PROFILES.md). */
export const MIN_AGE = 13;
export const MAX_AGE = 120;

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

function normalizeUser(user: User): User {
  return {
    ...user,
    role: user.role === "river" || user.role === "drop" ? user.role : "drop",
    name: user.name ?? "",
    age: typeof user.age === "number" ? user.age : MIN_AGE,
    bio: user.bio ?? "",
    interests: Array.isArray(user.interests) ? user.interests : [],
    createdAt: user.createdAt ?? new Date().toISOString(),
  };
}

function normalize(parsed: Partial<UsersData>): UsersData {
  const users = Array.isArray(parsed.users) ? parsed.users : [];
  return { users: users.map(normalizeUser) };
}

async function readStore(): Promise<UsersData> {
  return normalize(await readJson<UsersData>(USERS_PATH, EMPTY));
}

export async function getUser(id: string): Promise<User | null> {
  const { users } = await readStore();
  return users.find((user) => user.id === id) ?? null;
}

export async function listUsers(): Promise<User[]> {
  const { users } = await readStore();
  return users;
}

export async function createUser(input: {
  role: Role;
  name: string;
  age: number;
  bio?: string;
  interests?: string[];
}): Promise<User> {
  let created!: User;
  await mutateJson<UsersData>(USERS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    created = {
      id: `u-${randomUUID()}`,
      role: input.role,
      name: input.name.trim(),
      age: input.age,
      bio: input.bio?.trim() ?? "",
      interests: input.interests ?? [],
      createdAt: new Date().toISOString(),
    };
    data.users.push(created);
    return data;
  });
  return created;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  let updated: User | null = null;
  await mutateJson<UsersData>(USERS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.users.findIndex((user) => user.id === id);
    if (index !== -1) {
      updated = { ...data.users[index], ...patch, id };
      data.users[index] = updated;
    }
    return data;
  });
  return updated;
}

/**
 * Resolves the display authors for a page in one pass. Missing/null ids are
 * skipped so legacy seed content can render as "HistorAI community".
 */
export async function getPublicUserMap(
  ids: (string | null | undefined)[],
): Promise<Record<string, PublicUser>> {
  const wanted = new Set(ids.filter((id): id is string => Boolean(id)));
  if (wanted.size === 0) return {};

  const { users } = await readStore();
  const map: Record<string, PublicUser> = {};
  for (const user of users) {
    if (wanted.has(user.id)) {
      map[user.id] = toPublicUser(user);
    }
  }
  return map;
}
