// Shared TypeScript types for the platform

export type UserRole = "solution_architect" | "developer" | "devops" | "data_engineer";

export type Language = "en" | "hi" | "hinglish";

export type Priority = "critical" | "high" | "normal";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  language: Language;
}

export interface Update {
  id: string;
  title: string;
  rawContent: string;
  simplifiedEn: string;
  simplifiedHi?: string;
  simplifiedHinglish?: string;
  sourceUrl: string;
  publishedAt: string;
  category: string;
  serviceTags: string[];
  roleTags: UserRole[];
  priority: Priority;
}

export interface UserUpdateState {
  updateId: string;
  isRead: boolean;
  readAt?: string;
  isLastSeen?: boolean;
}
