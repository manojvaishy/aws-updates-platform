"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, saveSession } from "@/lib/auth";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const ROLES: { value: UserRole; label: string; description: string; emoji: string }[] = [
  { value: "solution_architect", label: "Solution Architect", description: "Architecture, pricing, new services", emoji: "🏗️" },
  { value: "developer", label: "Developer", description: "SDKs, APIs, Lambda, compute", emoji: "💻" },
  { value: "devops", label: "DevOps Engineer", description: "CI/CD, ECS, EKS, CloudFormation", emoji: "⚙️" },
  { value: "data_engineer", label: "Data Engineer", description: "Glue, Redshift, S3, Athena", emoji: "📊" },
];

export default function RoleSelectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const { token, user } = await updateProfile({ role: selected });
      saveSession(token, user);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-brand font-bold text-2xl">AWS</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-3">What&apos;s your role?</h1>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll personalize your feed based on what matters to you.
          </p>
        </div>

        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelected(role.value)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all min-h-tap",
                selected === role.value
                  ? "border-brand bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <span className="text-2xl">{role.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{role.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
              </div>
              {selected === role.value && (
                <span className="ml-auto text-brand text-lg" aria-hidden="true">✓</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="mt-6 w-full bg-brand-dark text-white py-3 rounded-xl text-sm font-medium hover:bg-brand-dark/90 transition-colors disabled:opacity-40 min-h-tap"
        >
          {loading ? "Saving…" : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
