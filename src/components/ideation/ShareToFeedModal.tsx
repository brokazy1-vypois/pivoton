import { useEffect, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ShareToFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  defaultDescription: string;
  isPublishing: boolean;
  onConfirm: (title: string, description: string) => void;
}

export function ShareToFeedModal({
  open,
  onOpenChange,
  defaultTitle,
  defaultDescription,
  isPublishing,
  onConfirm,
}: ShareToFeedModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
    }
  }, [open, defaultTitle, defaultDescription]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-700 bg-[#1e293b] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-cyan-400" />
            Deploy to Feed
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Save the executable code bundle and publish an interactive widget to the Idea Timeline.
            Other users can launch, test, and interact with your MVP directly in the feed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Project title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My SaaS MVP"
              className="border-slate-600 bg-slate-900/80 text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Short description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What does this prototype do?"
              className="border-slate-600 bg-slate-900/80 text-slate-100"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-600 text-slate-300"
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(title, description)}
            disabled={!title.trim() || isPublishing}
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Deploying…
              </>
            ) : (
              "Deploy to Feed"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
