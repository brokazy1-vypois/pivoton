import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarPlus, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useHangout } from "@/context/HangoutContext";
import { resolveTimezoneAtCoordinate } from "@/lib/mapbox-local-time";
import {
  buildGoogleCalendarTemplateUrl,
  createGoogleCalendarEvent,
  generateHangoutAgenda,
  getGoogleCalendarOAuthAuthorizeUrl,
} from "@/services/hangout";
import { mapProfilesToHangoutFriends } from "@/services/hangout-friends";
import { fetchAllUserMapProfiles } from "@/services/user-map-profiles";
import {
  getGoogleCalendarToken,
  isGoogleCalendarTokenValid,
} from "@/services/google-calendar-tokens";
import type { HangoutAgendaDraft } from "@/types/hangout";

function combineDateAndTime(date: Date, timeValue: string): Date {
  const [hours, minutes] = timeValue.split(":").map((part) => Number.parseInt(part, 10));
  const next = new Date(date);
  next.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

export function HangoutSchedulingModal() {
  const { user, openAuthModal } = useAuth();
  const { selectedVenue, schedulingOpen, closeScheduling } = useHangout();

  const profilesQuery = useQuery({
    queryKey: ["user-map-profiles"],
    queryFn: fetchAllUserMapProfiles,
    staleTime: 60_000,
  });

  const friends = useMemo(
    () => mapProfilesToHangoutFriends(profilesQuery.data ?? [], user?.id),
    [profilesQuery.data, user?.id],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  });
  const [timeValue, setTimeValue] = useState("18:00");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<HangoutAgendaDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedFriendIds.includes(friend.user_id)),
    [friends, selectedFriendIds],
  );

  const scheduledAt = useMemo(
    () => combineDateAndTime(selectedDate, timeValue).toISOString(),
    [selectedDate, timeValue],
  );

  const timeZone = useMemo(
    () =>
      selectedVenue
        ? resolveTimezoneAtCoordinate(selectedVenue.coordinate)
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    [selectedVenue],
  );

  useEffect(() => {
    if (!schedulingOpen) {
      setAgenda(null);
      setSelectedFriendIds([]);
    }
  }, [schedulingOpen]);

  useEffect(() => {
    if (!schedulingOpen || !selectedVenue) return;

    let cancelled = false;

    async function generate() {
      setIsGenerating(true);
      try {
        const draft = await generateHangoutAgenda({
          venue: selectedVenue!,
          scheduledAt,
          friends: selectedFriends,
          hostName: user?.fullName ?? "You",
        });
        if (!cancelled) setAgenda(draft);
      } catch (error) {
        if (!cancelled) {
          toast.error("Could not generate hangout notes", {
            description: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }

    const timeoutId = window.setTimeout(() => {
      void generate();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [schedulingOpen, selectedVenue, scheduledAt, selectedFriends, user?.fullName]);

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  async function ensureGoogleAccessToken(): Promise<string | null> {
    if (!user) return null;

    const existing = getGoogleCalendarToken(user.id);
    if (isGoogleCalendarTokenValid(existing)) {
      return existing!.accessToken;
    }

    const { url } = await getGoogleCalendarOAuthAuthorizeUrl(user.id, "/feed");
    window.sessionStorage.setItem("pivoton-hangout-oauth-pending", "1");
    window.location.href = url;
    return null;
  }

  async function handleAddToGoogleCalendar() {
    if (!user) {
      openAuthModal("Sign in to schedule a hangout and sync with Google Calendar.");
      return;
    }
    if (!selectedVenue || !agenda) return;
    if (selectedFriends.length === 0) {
      toast.error("Select at least one friend to invite.");
      return;
    }

    setIsSaving(true);
    try {
      const accessToken = await ensureGoogleAccessToken();
      if (!accessToken) return;

      const result = await createGoogleCalendarEvent({
        accessToken,
        venue: selectedVenue,
        agenda,
        scheduledAt,
        timeZone,
        friends: selectedFriends,
      });

      toast.success("Hangout added to Google Calendar", {
        description: "Invites were sent to selected friends.",
      });

      if (result.htmlLink) {
        window.open(result.htmlLink, "_blank", "noopener,noreferrer");
      }

      closeScheduling();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("Google Calendar OAuth is not configured")) {
        const templateUrl = buildGoogleCalendarTemplateUrl({
          title: agenda.title,
          details: `${agenda.invitationText}\n\n${agenda.agendaNotes}`,
          location: selectedVenue.address,
          scheduledAt,
        });
        window.open(templateUrl, "_blank", "noopener,noreferrer");
        toast.success("Opened Google Calendar template", {
          description: "Connect Google OAuth in env to send automatic email invites.",
        });
        closeScheduling();
        return;
      }

      toast.error("Failed to add Google Calendar event", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={schedulingOpen} onOpenChange={(open) => !open && closeScheduling()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Schedule a Hangout
          </DialogTitle>
          <DialogDescription>
            {selectedVenue
              ? `Plan an offline meetup at ${selectedVenue.name}. Gemini drafts the invite and agenda automatically.`
              : "Pick a venue on the map to start planning."}
          </DialogDescription>
        </DialogHeader>

        {selectedVenue ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-border/70 bg-surface-2/40 p-3">
              <p className="text-sm font-medium">{selectedVenue.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedVenue.address}</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite friends
              </Label>
              <div className="custom-scrollbar max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/70 p-3">
                {friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No friends available in this region yet.</p>
                ) : (
                  friends.map((friend) => (
                    <label
                      key={friend.user_id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2/60"
                    >
                      <Checkbox
                        checked={selectedFriendIds.includes(friend.user_id)}
                        onCheckedChange={() => toggleFriend(friend.user_id)}
                      />
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                        {friend.avatar.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{friend.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {friend.region ?? friend.email ?? "Network member"}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {format(selectedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hangout-time">Time</Label>
                <Input
                  id="hangout-time"
                  type="time"
                  value={timeValue}
                  onChange={(event) => setTimeValue(event.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Local time · {timeZone}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI meeting notes
              </Label>
              {isGenerating ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gemini is drafting your hangout agenda…
                </div>
              ) : agenda ? (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">Title</p>
                    <Input
                      value={agenda.title}
                      onChange={(event) =>
                        setAgenda((current) =>
                          current ? { ...current, title: event.target.value } : current,
                        )
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">Invitation</p>
                    <Textarea
                      value={agenda.invitationText}
                      onChange={(event) =>
                        setAgenda((current) =>
                          current ? { ...current, invitationText: event.target.value } : current,
                        )
                      }
                      className="mt-1 min-h-20"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">Agenda</p>
                    <Textarea
                      value={agenda.agendaNotes}
                      onChange={(event) =>
                        setAgenda((current) =>
                          current ? { ...current, agendaNotes: event.target.value } : current,
                        )
                      }
                      className="mt-1 min-h-28"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select friends and a time to generate smart hangout notes.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={closeScheduling}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={!selectedVenue || !agenda || isGenerating || isSaving}
            onClick={() => void handleAddToGoogleCalendar()}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Add to Google Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
