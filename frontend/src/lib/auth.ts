"use client";

import { User } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface AuthResponse {
  token: string;
  user: User & { language_preference: string };
  isFirstLogin?: boolean;
}

export async function register(data: {
  email: string;
  password: string;
  name: string;
  role: string;
  languagePreference?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Registration failed");
  return json;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Login failed");
  return json;
}

export async function updateProfile(data: {
  role?: string;
  languagePreference?: string;
}): Promise<AuthResponse> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}/api/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Update failed");
  return json;
}

export function saveSession(token: string, user: object) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getStoredUser(): (User & { language_preference: string }) | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
