"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PriorityBadge } from "@/components/updates/PriorityBadge";
import { formatDate, cn } from "@/lib/utils";
import { Language, Priority, UserRole } from "@/types";
import { Analytics } from "@/lib/analytics";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UpdateDetail {
  id: string;
  title: string;
  raw_content: string;
  simplified_en: string | null;
  simplified_hi: string | null;
  simplified_hinglish: string | null;
  source_url: string;
  published_at: string;
  category: string;
  service_tags: string[];
  role_tags: UserRole[];
  priority: Priority;
}

type ContentView = "simplified" | "original";

export default function UpdateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [update, setUpdate] = useState<UpdateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentView, setContentView] = useState<ContentView>("simplified");
  const [language, setLanguage] = useState<Language>(() => {
    // Default to user's saved language preference
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("user") ?? "{}");
        return (user?.language_preference as Language) ?? "en";
      } catch { return "en"; }
    }
    return "en";
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/updates/${id}`);
        if (!res.ok) { router.push("/dashboard"); return; }
        const data = await res.json();
        setUpdate(data);
        // Fire update_viewed event (task 13.1)
        Analytics.updateViewed(id);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  function getContent(): string {
    if (!update) return "";
    if (contentView === "original") return update.raw_content;
    if (language === "hi") return update.simplified_hi || update.simplified_en || update.raw_content;
    if (language === "hinglish") return update.simplified_hinglish || update.simplified_en || update.raw_content;
    return update.simplified_en || update.raw_content;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-3/4 bg-gray-100 rounded" />
        <div className="h-4 w-1/2 bg-gray-100 rounded" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!update) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 overflow-x-hidden">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors min-h-tap"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <PriorityBadge priority={update.priority} />
          <span className="text-xs text-gray-500">{update.category}</span>
          {update.service_tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
              {tag}
            </span>
          ))}
        </div>
        <h1 className="text-lg font-semibold text-gray-900 leading-snug break-words">{update.title}</h1>
        <p className="text-xs text-gray-400 mt-1">{formatDate(update.published_at)}</p>
      </div>

      {/* Content toggles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Simplified / Original toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5" role="group">
          {(["simplified", "original"] as ContentView[]).map((v) => (
            <button
              key={v}
              onClick={() => setContentView(v)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors min-h-tap capitalize",
                contentView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Language toggle — only shown for simplified view */}
        {contentView === "simplified" && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5" role="group">
            {(["en", "hi", "hinglish"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => { Analytics.languageSwitched(language, lang, id); setLanguage(lang); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors min-h-tap",
                  language === lang ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {lang === "en" ? "English" : lang === "hi" ? "Hindi" : "Hinglish"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        {contentView === "original" ? (
          <div
            className="prose prose-sm max-w-none text-gray-700 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: getContent() }}
          />
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {getContent() || "Simplified content not yet available."}
          </p>
        )}
      </div>

      {/* External link */}
      <a
        href={update.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-brand hover:underline min-h-tap"
      >
        Read original on AWS ↗
      </a>
    </div>
  );
}
