import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HangoutVenue } from "@/types/hangout";

interface HangoutContextValue {
  selectedVenue: HangoutVenue | null;
  locationPanelOpen: boolean;
  schedulingOpen: boolean;
  openVenue: (venue: HangoutVenue) => void;
  closeVenue: () => void;
  openScheduling: () => void;
  closeScheduling: () => void;
}

const HangoutContext = createContext<HangoutContextValue | null>(null);

export function HangoutProvider({ children }: { children: ReactNode }) {
  const [selectedVenue, setSelectedVenue] = useState<HangoutVenue | null>(null);
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const [schedulingOpen, setSchedulingOpen] = useState(false);

  const openVenue = useCallback((venue: HangoutVenue) => {
    setSelectedVenue(venue);
    setLocationPanelOpen(true);
  }, []);

  const closeVenue = useCallback(() => {
    setLocationPanelOpen(false);
  }, []);

  const openScheduling = useCallback(() => {
    setSchedulingOpen(true);
  }, []);

  const closeScheduling = useCallback(() => {
    setSchedulingOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      selectedVenue,
      locationPanelOpen,
      schedulingOpen,
      openVenue,
      closeVenue,
      openScheduling,
      closeScheduling,
    }),
    [selectedVenue, locationPanelOpen, schedulingOpen, openVenue, closeVenue, openScheduling, closeScheduling],
  );

  return <HangoutContext.Provider value={value}>{children}</HangoutContext.Provider>;
}

export function useHangout() {
  const context = useContext(HangoutContext);
  if (!context) {
    throw new Error("useHangout must be used within HangoutProvider");
  }
  return context;
}
