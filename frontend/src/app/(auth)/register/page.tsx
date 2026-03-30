"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, saveSession } from "@/lib/auth";
import { UserRole } from "@/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "solution_architect", label: "Solution Architect" },
  { value: "developer", label: "Developer" },
  { value: "devops", label: "DevOps Engineer" },
  { value: "data_engineer", label: "Data Engineer" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "" as UserRole | "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role) { setError("Please select your role"); return; }
    setError("");
    setLoading(true);
    try {
      const { token, user } = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      saveSession(token, user);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-brand font-bold text-2xl">AWS</span>
          <p className="text-gray-500 text-sm mt-1">Updates Platform</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-6">Create account</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: "name", label: "Full name", type: "text", placeholder: "Alice Smith", autoComplete: "name" },
              { id: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
              { id: "password", label: "Password", type: "password", placeholder: "Min 8 characters", autoComplete: "new-password" },
            ].map(({ id, label, type, placeholder, autoComplete }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  id={id} type={type} autoComplete={autoComplete} required
                  value={form[id as keyof typeof form]}
                  onChange={set(id)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent min-h-tap"
                />
              </div>
            ))}

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Your role</label>
              <select
                id="role" required
                value={form.role}
                onChange={set("role")}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand min-h-tap"
              >
                <option value="">Select a role…</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-brand-dark text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark/90 transition-colors disabled:opacity-50 min-h-tap"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
