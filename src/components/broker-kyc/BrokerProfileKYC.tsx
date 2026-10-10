import { BadgeCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBrokerKyc } from "@/context/BrokerKycContext";

const LICENSES = [
  "Securities Industry Essentials (SIE)",
  "General Securities Representative Qualification Examination (Series 7)",
  "Uniform Securities Agent State Law Examination (Series 63)",
  "Investment Adviser Representative (IAR – Series 65)",
];

export function BrokerProfileKYC() {
  const {
    profile,
    canPostRecommendations,
    setDisplayName,
    setJobTitle,
    setIsBroker,
    setLicense,
    setLicenseFile,
    submitKyc,
    setKycApproved,
  } = useBrokerKyc();

  const handleSave = () => {
    if (profile.isBroker) {
      if (!profile.license) {
        toast.error("Select a license type before saving.");
        return;
      }
      if (!profile.licenseFileName) {
        toast.error("Upload your license document before saving.");
        return;
      }
      submitKyc();
      toast.success("Profile saved", {
        description: profile.isKycApproved
          ? "Your broker license is approved — you can post in private rooms."
          : "KYC submitted. Awaiting compliance review (1–2 business days).",
      });
    } else {
      toast.success("Profile saved");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLicenseFile(file ? file.name : null);
  };

  return (
    <div className="panel max-w-2xl space-y-6 p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            placeholder="Marisol Vega"
            value={profile.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input
            id="title"
            placeholder="Senior Equity Strategist"
            value={profile.jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border p-4">
        <Checkbox
          id="is-broker"
          checked={profile.isBroker}
          onCheckedChange={(v) => setIsBroker(v === true)}
        />
        <div>
          <Label htmlFor="is-broker" className="cursor-pointer">
            I am a registered stock broker
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Ticking this publishes your job title and verified license on your profile.
          </p>
        </div>
      </div>

      {profile.isBroker && (
        <div className="space-y-4 border-l-2 border-primary/50 pl-5">
          <div className="space-y-2">
            <Label>License type for KYC verification</Label>
            <Select value={profile.license} onValueChange={setLicense}>
              <SelectTrigger>
                <SelectValue placeholder="Select your license" />
              </SelectTrigger>
              <SelectContent>
                {LICENSES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license-file">Upload license document</Label>
            <label
              htmlFor="license-file"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/60"
            >
              <Upload className="h-4 w-4" />
              {profile.licenseFileName
                ? profile.licenseFileName
                : "PDF, JPG or PNG — reviewed by the Pivoton compliance team"}
            </label>
            <Input
              id="license-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.isKycSubmitted && (
              <Badge variant="outline" className="border-gold/40 text-gold">
                KYC submitted
              </Badge>
            )}
            {profile.isKycApproved && (
              <Badge className="gap-1 bg-primary/20 text-primary hover:bg-primary/20">
                <BadgeCheck className="h-3 w-3" />
                Approved broker
              </Badge>
            )}
            {profile.isKycSubmitted && !profile.isKycApproved && (
              <Badge variant="secondary">Pending review</Badge>
            )}
          </div>
        </div>
      )}

      {/* Mock admin approval toggle for demo/testing */}
      {profile.isKycSubmitted && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Mock admin approval (demo)</p>
            <p className="text-xs text-muted-foreground">
              Toggle to simulate compliance approving your license for posting.
            </p>
          </div>
          <Switch
            checked={profile.isKycApproved}
            onCheckedChange={setKycApproved}
            aria-label="Mock KYC approval"
          />
        </div>
      )}

      {canPostRecommendations && (
        <p className="text-xs text-primary">
          You have posting access in all private room signal feeds.
        </p>
      )}

      <Button onClick={handleSave}>Save profile</Button>
    </div>
  );
}
