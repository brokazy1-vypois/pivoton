import { Link } from "@tanstack/react-router";
import { Lightbulb, MapPin, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedViewTab = "feed" | "contact-search" | "ideas";

interface FeedSubNavProps {
  activeTab: FeedViewTab;
}

const TABS: Array<{ id: FeedViewTab; label: string; icon: typeof Newspaper; search: { tab?: string } }> = [
  { id: "feed", label: "Feed", icon: Newspaper, search: {} },
  { id: "contact-search", label: "Contact Search", icon: MapPin, search: { tab: "contact-search" } },
  { id: "ideas", label: "Ideas", icon: Lightbulb, search: { tab: "ideas" } },
];

export function FeedSubNav({ activeTab }: FeedSubNavProps) {
  return (
    <div className="mb-6 inline-flex rounded-full border border-slate-800 bg-[#0F172A] p-1">
      {TABS.map(({ id, label, icon: Icon, search }) => (
        <Link
          key={id}
          to="/feed"
          search={search}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
            activeTab === id
              ? "bg-[#1E293B] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </div>
  );
}
