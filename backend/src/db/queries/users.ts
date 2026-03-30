import { getDB } from "../../config/db";
import { User, UserRole, Language } from "../../types";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  languagePreference?: Language;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  language_preference: Language;
  is_first_login: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Insert a new user. Throws on duplicate email (unique constraint).
 */
export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const result = await getDB().query<UserRow>(
    `INSERT INTO users (email, password_hash, name, role, language_preference)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.email.toLowerCase().trim(),
      input.passwordHash,
      input.name,
      input.role,
      input.languagePreference ?? "en",
    ]
  );
  return result.rows[0];
}

/**
 * Find a user by email (case-insensitive).
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await getDB().query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] ?? null;
}

/**
 * Find a user by ID.
 */
export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await getDB().query<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * Update a user's role and/or language preference.
 */
export async function updateUserProfile(
  id: string,
  updates: { role?: UserRole; languagePreference?: Language; isFirstLogin?: boolean }
): Promise<UserRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.role !== undefined) {
    fields.push(`role = $${idx++}`);
    values.push(updates.role);
  }
  if (updates.languagePreference !== undefined) {
    fields.push(`language_preference = $${idx++}`);
    values.push(updates.languagePreference);
  }
  if (updates.isFirstLogin !== undefined) {
    fields.push(`is_first_login = $${idx++}`);
    values.push(updates.isFirstLogin);
  }

  if (!fields.length) return findUserById(id);

  values.push(id);
  const result = await getDB().query<UserRow>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/**
 * Map a DB row to the public User type (strips password_hash).
 */
export function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    language_preference: row.language_preference,
    created_at: row.created_at,
  };
}
