"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/nav/NavIcons";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  defaultValue?: string;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  className,
  placeholder = "Search AWS updates…",
  autoFocus = false,
  defaultValue = "",
  onSearch,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setValue("");
      inputRef.current?.blur();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("relative flex items-center", className)}
    >
      <label htmlFor="global-search" className="sr-only">
        Search AWS updates
      </label>

      {/* Search icon */}
      <SearchIcon className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none shrink-0" />

      <input
        ref={inputRef}
        id="global-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "w-full pl-9 pr-4 py-2 rounded-lg text-sm",
          "bg-gray-100 border border-transparent",
          "focus:outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand",
          "placeholder:text-gray-400 transition-colors"
        )}
        aria-label="Search AWS updates"
      />

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={() => { setValue(""); inputRef.current?.focus(); }}
          className="absolute right-2 text-gray-400 hover:text-gray-600 min-h-tap min-w-tap flex items-center justify-center"
          aria-label="Clear search"
        >
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>
      )}
    </form>
  );
}
