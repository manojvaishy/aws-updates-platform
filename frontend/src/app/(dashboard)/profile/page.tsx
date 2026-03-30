"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, saveSession, getStoredUser, clearSession } from "@/lib/auth";
import { UserRole, Language } from "@/types";
import { cn } from "@/lib/utils";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "solution_architect", label: "Solution Architect" },
  { value: "developer", label: "Developer" },
  { value: "devops", label: "DevOps Engineer" },
  { value: "data_engineer", label: "Data Engineer" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];

export default function ProfilePage() {
  const router = useRouter();
  const user = getStoredUser();

  const [role, setRole] = useState<UserRole>(user?.role ?? "developer");
  const [language, setLanguage] = useState<Language>(
    (user?.language_preference as Language) ?? "en"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { token, user: updated } = await updateProfile({
        role,
        languagePreference: language,
      });
      saveSession(token, updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto space-y-6 overflow-x-hidden">
      <h1 className="text-xl font-semibold text-gray-900">Profile</h1>

      {/* User info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
      </div>

      {/* Role selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Your Role</h2>
        <div className="grid grid-cols-1 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors min-h-tap",
                role === r.value
                  ? "border-brand bg-orange-50 text-gray-900 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {r.label}
              {role === r.value && <span className="text-brand" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Language preference */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Language</h2>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => setLanguage(l.value)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-colors min-h-tap",
                language === l.value
                  ? "border-brand bg-orange-50 text-gray-900 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-brand-dark text-white py-3 rounded-xl text-sm font-medium hover:bg-brand-dark/90 transition-colors disabled:opacity-50 min-h-tap"
      >
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
      </button>

      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors min-h-tap"
      >
        Sign out
      </button>
    </div>
  );
}
