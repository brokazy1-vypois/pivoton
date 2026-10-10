import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { IdeaCard } from "@/components/ideation/IdeaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedPrototypes } from "@/services/ideation-prototypes";

interface IdeaGalleryViewProps {
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserAvatar?: string;
  onRequireAuth?: () => void;
}

export function IdeaGalleryView({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onRequireAuth,
}: IdeaGalleryViewProps) {
  const query = useQuery({
    queryKey: ["ideation-published-prototypes"],
    queryFn: fetchPublishedPrototypes,
    staleTime: 30_000,
  });

  const prototypes = query.data ?? [];

  return (
    <div>
      <div className="flex items-center gap-3">
        <Lightbulb className="h-8 w-8 text-cyan-400" />
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Idea gallery</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Explore MVP prototypes and software ideas shared by the Pivoton community. Rate projects
            and leave feedback to help builders iterate.
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {query.isLoading ? (
          <>
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </>
        ) : prototypes.length === 0 ? (
          <div className="panel p-10 text-center">
            <Lightbulb className="mx-auto h-10 w-10 text-slate-600" />
            <h2 className="mt-4 text-lg font-semibold">No shared ideas yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Build a prototype in Ideation Studio and share it to kick off the gallery.
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
            />
          ))
        )}
      </div>
    </div>
  );
}
