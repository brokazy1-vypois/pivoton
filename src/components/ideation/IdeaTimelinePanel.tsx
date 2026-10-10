import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { IdeaCard } from "@/components/ideation/IdeaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchUserPrototypes } from "@/services/ideation-prototypes";

interface IdeaTimelinePanelProps {
  userId: string;
  userName: string;
  isOwnProfile?: boolean;
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserAvatar?: string;
  onRequireAuth?: () => void;
}

export function IdeaTimelinePanel({
  userId,
  userName,
  isOwnProfile,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onRequireAuth,
}: IdeaTimelinePanelProps) {
  const query = useQuery({
    queryKey: ["ideation-user-prototypes", userId, "published"],
    queryFn: () => fetchUserPrototypes(userId, { publishedOnly: true }),
    staleTime: 30_000,
  });

  const prototypes = query.data ?? [];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold">Idea timeline</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwnProfile
          ? "Your published MVP prototypes, newest first."
          : `Published prototypes shared by ${userName}, newest first.`}
      </p>

      <div className="mt-6 space-y-6">
        {query.isLoading ? (
          <>
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </>
        ) : prototypes.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {isOwnProfile
                ? "No published ideas yet. Save a prototype in Ideation Studio and share it to the feed."
                : `${userName} has not published any ideas yet.`}
            </p>
          </div>
        ) : (
          prototypes.map((prototype) => (
            <IdeaCard
              key={prototype.id}
              prototype={prototype}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
              onRequireAuth={onRequireAuth}
              compactPreview
            />
          ))
        )}
      </div>
    </div>
  );
}
