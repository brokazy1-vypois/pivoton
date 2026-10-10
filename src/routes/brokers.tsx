import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ChevronDown, History, Lock, Phone, TrendingUp, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomCallHistoryModal } from "@/components/broker-meeting/RoomCallHistoryModal";
import { BrokerKycProvider } from "@/context/BrokerKycContext";
import { BrokerProfileKYC } from "@/components/broker-kyc/BrokerProfileKYC";
import { PrivateRoomFeedModal } from "@/components/private-room/PrivateRoomFeedModal";
import { countCallSummariesForRoom } from "@/services/call-summaries";
import { roomIdFromName } from "@/types/call-summary";
import type { BrokerRoom } from "@/types/meeting";

const BrokerMeetingModal = lazy(() =>
  import("@/components/broker-meeting/BrokerMeetingModal").then((m) => ({
    default: m.BrokerMeetingModal,
  })),
);

export const Route = createFileRoute("/brokers")({
  head: () => ({
    meta: [
      { title: "Brokers & Private Rooms — Pivoton Consultancy" },
      {
        name: "description",
        content:
          "Join chargeable private rooms from KYC-verified brokers holding SIE, Series 7, Series 63 or Series 65 licenses, and audit their recommendation history.",
      },
      { property: "og:title", content: "Pivoton Broker Rooms & Licensing" },
      {
        property: "og:description",
        content: "Chargeable VIP rooms, live consultancy calls, and license-verified broker profiles.",
      },
    ],
  }),
  component: BrokersPage,
});

const rooms: BrokerRoom[] = [
  {
    broker: "Marisol Vega",
    title: "Senior Equity Strategist",
    license: "Series 7",
    room: "Pre-open Momentum Desk",
    price: "$120 / cycle",
    members: 412,
    hit: "72%",
    calls: 318,
  },
  {
    broker: "Daniel Okafor",
    title: "Derivatives Adviser",
    license: "Series 65",
    room: "Hedged ETF Rotations",
    price: "$85 / cycle",
    members: 268,
    hit: "66%",
    calls: 197,
  },
  {
    broker: "Hana Ito",
    title: "Registered Representative",
    license: "Series 63",
    room: "Small Cap Rumor Desk",
    price: "$150 / cycle",
    members: 129,
    hit: "61%",
    calls: 144,
  },
];

function BrokersPage() {
  return (
    <BrokerKycProvider>
      <Brokers />
    </BrokerKycProvider>
  );
}

function Brokers() {
  const [meetingRoom, setMeetingRoom] = useState<BrokerRoom | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [feedRoom, setFeedRoom] = useState<BrokerRoom | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<BrokerRoom | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedCallCounts, setSavedCallCounts] = useState<Record<string, number>>({});

  const refreshSavedCallCounts = useCallback(async () => {
    const entries = await Promise.all(
      rooms.map(async (r) => {
        const id = roomIdFromName(r.room);
        const count = await countCallSummariesForRoom(id);
        return [id, count] as const;
      }),
    );
    setSavedCallCounts(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    void refreshSavedCallCounts();
  }, [refreshSavedCallCounts]);

  const launchVideoCall = (room: BrokerRoom) => {
    setMeetingRoom(room);
    setMeetingOpen(true);
  };

  const openSignalFeed = (room: BrokerRoom) => {
    setFeedRoom(room);
    setFeedOpen(true);
  };

  const openCallHistory = (room: BrokerRoom) => {
    setHistoryRoom(room);
    setHistoryOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <h1 className="text-4xl font-semibold sm:text-5xl">Broker consultancy</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Brokers configure as many chargeable private rooms as they like. Members receive VIP
        recommendations; premium members can track every call and dial the broker live during a
        trading session.
      </p>

      <Tabs defaultValue="rooms" className="mt-12">
        <TabsList>
          <TabsTrigger value="rooms">Private rooms</TabsTrigger>
          <TabsTrigger value="profile">Broker profile & KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-8 grid gap-6 lg:grid-cols-3">
          {rooms.map((r) => {
            const roomKey = roomIdFromName(r.room);
            const savedCount = savedCallCounts[roomKey] ?? 0;

            return (
            <div key={r.room} className="panel flex flex-col p-7">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{r.broker}</span>
                <Badge variant="secondary" className="ml-auto">
                  {r.license}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.title}</p>

              <h2 className="mt-6 text-lg font-semibold">{r.room}</h2>
              <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
                <Stat label="Hit rate" value={r.hit} />
                <Stat label="Calls logged" value={String(r.calls + savedCount)} />
                <Stat label="Members" value={String(r.members)} />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="shrink-0 font-display text-xl font-semibold">{r.price}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <RoomCallTrigger
                    brokerName={r.broker}
                    savedCount={savedCount}
                    onViewHistory={() => openCallHistory(r)}
                    onStartCall={() => launchVideoCall(r)}
                  />
                  <Button size="sm" className="whitespace-nowrap" onClick={() => openSignalFeed(r)}>
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Join room
                  </Button>
                </div>
              </div>
            </div>
            );
          })}

          <div className="panel col-span-full flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
            Premium members get an analytics view of every recommendation issued in rooms they join
            — entry, exit, drawdown and realised result.
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-8">
          <BrokerProfileKYC />
        </TabsContent>
      </Tabs>

      <Suspense fallback={null}>
        <BrokerMeetingModal
          room={meetingRoom}
          open={meetingOpen}
          onOpenChange={setMeetingOpen}
          onSummarySaved={() => void refreshSavedCallCounts()}
        />
      </Suspense>

      <RoomCallHistoryModal
        room={historyRoom}
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) void refreshSavedCallCounts();
        }}
      />

      <PrivateRoomFeedModal room={feedRoom} open={feedOpen} onOpenChange={setFeedOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-base font-semibold text-primary">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function RoomCallTrigger({
  brokerName,
  savedCount,
  onViewHistory,
  onStartCall,
}: {
  brokerName: string;
  savedCount: number;
  onViewHistory: () => void;
  onStartCall: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="relative h-9 gap-0.5 border-border bg-[#121824] px-2.5 hover:bg-secondary"
          aria-label={`Call history and video options for ${brokerName}`}
        >
          <Phone className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
          {savedCount > 0 && (
            <span
              className="absolute -bottom-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0B0E14]"
              aria-label={`${savedCount} saved call notes`}
            >
              {savedCount > 99 ? "99+" : savedCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-border bg-[#121824]">
        <DropdownMenuItem
          className="cursor-pointer focus:bg-secondary"
          onClick={onViewHistory}
        >
          <History className="mr-2 h-4 w-4 text-primary" />
          Call history
          {savedCount > 0 && (
            <span className="ml-auto text-xs text-emerald-400">{savedCount}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-secondary"
          onClick={onStartCall}
        >
          <Phone className="mr-2 h-4 w-4" />
          Start video call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
