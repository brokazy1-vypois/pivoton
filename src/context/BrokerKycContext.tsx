import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBrokerKey } from "@/types/signal-feed";

const STORAGE_KEY = "pivoton-broker-kyc";

export interface BrokerKycProfile {
  displayName: string;
  jobTitle: string;
  brokerKey: string;
  isBroker: boolean;
  license: string;
  licenseFileName: string | null;
  isKycSubmitted: boolean;
  isKycApproved: boolean;
}

const defaultProfile: BrokerKycProfile = {
  displayName: "",
  jobTitle: "",
  brokerKey: "",
  isBroker: false,
  license: "",
  licenseFileName: null,
  isKycSubmitted: false,
  isKycApproved: false,
};

function loadProfile(): BrokerKycProfile {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile;
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {
    return defaultProfile;
  }
}

function saveProfile(profile: BrokerKycProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

interface BrokerKycContextValue {
  profile: BrokerKycProfile;
  canPostRecommendations: boolean;
  setDisplayName: (v: string) => void;
  setJobTitle: (v: string) => void;
  setIsBroker: (v: boolean) => void;
  setLicense: (v: string) => void;
  setLicenseFile: (fileName: string | null) => void;
  submitKyc: () => boolean;
  setKycApproved: (approved: boolean) => void;
}

const BrokerKycContext = createContext<BrokerKycContextValue | null>(null);

export function BrokerKycProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BrokerKycProfile>(loadProfile);

  const persist = useCallback((next: BrokerKycProfile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  const canPostRecommendations = profile.isKycApproved;

  const value = useMemo<BrokerKycContextValue>(
    () => ({
      profile,
      canPostRecommendations,
      setDisplayName: (displayName) =>
        persist({
          ...profile,
          displayName,
          brokerKey: profile.brokerKey || getBrokerKey(displayName),
        }),
      setJobTitle: (jobTitle) => persist({ ...profile, jobTitle }),
      setIsBroker: (isBroker) =>
        persist({
          ...profile,
          isBroker,
          ...(isBroker ? {} : { license: "", licenseFileName: null }),
        }),
      setLicense: (license) => persist({ ...profile, license }),
      setLicenseFile: (licenseFileName) => persist({ ...profile, licenseFileName }),
      submitKyc: () => {
        if (!profile.isBroker || !profile.license || !profile.licenseFileName) {
          return false;
        }
        persist({
          ...profile,
          isKycSubmitted: true,
          brokerKey: getBrokerKey(profile.displayName),
        });
        return true;
      },
      setKycApproved: (isKycApproved) => persist({ ...profile, isKycApproved }),
    }),
    [canPostRecommendations, persist, profile],
  );

  return <BrokerKycContext.Provider value={value}>{children}</BrokerKycContext.Provider>;
}

export function useBrokerKyc() {
  const ctx = useContext(BrokerKycContext);
  if (!ctx) throw new Error("useBrokerKyc must be used within BrokerKycProvider");
  return ctx;
}
