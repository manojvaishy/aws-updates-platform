export type UserRole = "solution_architect" | "developer" | "devops" | "data_engineer";
export type Language = "en" | "hi" | "hinglish";
export type Priority = "critical" | "high" | "normal";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface Update {
  id: string;
  title: string;
  raw_content: string;
  simplified_en: string;
  simplified_hi?: string;
  simplified_hinglish?: string;
  source_url: string;
  published_at: Date;
  category: string;
  service_tags: string[];
  role_tags: UserRole[];
  priority: Priority;
  processed_at?: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  language_preference: Language;
  created_at: Date;
}
