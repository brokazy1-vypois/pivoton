import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatUserMapLocation,
  searchUserMapProfiles,
} from "@/services/user-map-profiles";
import type { UserMapProfile } from "@/types/user-map-profile";

interface ContactUserSearchBarProps {
  profiles: UserMapProfile[];
  isLoading?: boolean;
  onSelectUser: (profile: UserMapProfile) => void;
}

export function ContactUserSearchBar({
  profiles,
  isLoading,
  onSelectUser,
}: ContactUserSearchBarProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () => searchUserMapProfiles(profiles, query),
    [profiles, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const showDropdown = open && query.trim().length > 0;

  function selectProfile(profile: UserMapProfile) {
    onSelectUser(profile);
    setQuery(profile.full_name);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const profile = suggestions[activeIndex];
      if (profile) selectProfile(profile);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder="Search members by name or location…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-11 border-slate-700/80 bg-[#0F172A] pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary/40"
        />
        {isLoading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0B1220] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
        >
          {suggestions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              No members match &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <ul className="custom-scrollbar max-h-72 overflow-y-auto py-1">
              {suggestions.map((profile, index) => {
                const location = formatUserMapLocation(profile);
                const initials = (profile.avatar || profile.full_name).slice(0, 2).toUpperCase();

                return (
                  <li key={profile.user_id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectProfile(profile)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        index === activeIndex
                          ? "bg-primary/10 text-slate-100"
                          : "text-slate-200 hover:bg-slate-800/70",
                      )}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-600 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]">
                        {initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{profile.full_name}</span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0 text-primary/80" />
                          {location}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
