import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { IdCard, ScanFace, FileText, Check, Loader2, Lock, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useUserBalance } from "@/context/UserBalanceContext";
import { extractMonthlySalaryFromContract } from "@/lib/salary-extraction";
import { applySalaryVerification } from "@/services/user-balances";
import { listInvestmentHoldings } from "@/services/investment-holdings";
import { formatUsd } from "@/lib/pivoton-erp";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Margin Loans — Pivoton Salary-Backed Credit" },
      {
        name: "description",
        content:
          "Request a margin loan of up to one month's salary with ID, face-scan and labor-contract verification, then track how much is spent versus invested inside Pivoton.",
      },
      { property: "og:title", content: "Pivoton Margin Loans" },
      {
        property: "og:description",
        content: "Salary-backed credit with full KYC and a spend-versus-invested management view.",
      },
    ],
  }),
  component: Loans,
});

function Loans() {
  const { user, openAuthModal } = useAuth();
  const { balance, refreshBalance } = useUserBalance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const holdingsQuery = useQuery({
    queryKey: ["investment-holdings", user?.id],
    queryFn: () => listInvestmentHoldings(user!.id),
    enabled: Boolean(user?.id),
  });

  const laborVerified = balance?.labor_contract_verified ?? false;
  const disbursed = balance?.disbursed_loan_balance ?? 0;
  const spent = balance?.spent_via_pos ?? 0;
  const invested = balance?.under_investment ?? 0;
  const available = balance?.available_balance ?? 0;
  const total = disbursed || spent + invested + available;

  const allocation = [
    { label: "Under investment in Pivoton", amount: invested, tone: "bg-primary" },
    { label: "Spent via POS / partners", amount: spent, tone: "bg-gold" },
    { label: "Available", amount: available, tone: "bg-secondary" },
  ].filter((a) => total > 0 || a.amount > 0);

  const steps = [
    { icon: IdCard, title: "Government ID", note: "Front and back, unexpired", done: true },
    { icon: ScanFace, title: "Face scan", note: "Liveness check against your ID", done: true },
    {
      icon: FileText,
      title: "Labor contract",
      note: "Confirms employment and salary",
      done: laborVerified,
    },
  ];

  const handleUploadClick = () => {
    if (!user) {
      openAuthModal("Sign in to upload your labor contract");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploading(true);
    try {
      toast.message("Analyzing labor contract…", {
        description: "Gemini AI is extracting your monthly salary.",
      });

      const monthlySalary = await extractMonthlySalaryFromContract(file);
      await applySalaryVerification(user.id, monthlySalary);
      await refreshBalance();

      toast.success("Labor contract verified", {
        description: `Disbursed loan set to ${formatUsd(monthlySalary)} based on extracted salary.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salary extraction failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-4xl font-semibold sm:text-5xl">Margin loans</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Borrow up to one month of verified salary. Verification is required before disbursement, and
        every dollar is tracked after it lands.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="panel p-8">
          <h2 className="text-lg font-semibold">Verification</h2>
          <div className="mt-7 space-y-6">
            {steps.map((s) => (
              <div key={s.title} className="flex items-start gap-4">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                    s.done
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </span>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
                {s.done && (
                  <Badge variant="secondary" className="ml-auto border-primary/30 text-primary">
                    Verified
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button className="mt-8 w-full" onClick={handleUploadClick} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting salary…
              </>
            ) : (
              "Upload labor contract"
            )}
          </Button>
        </div>

        <div className="panel p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Disbursed loan</h2>
            <span className="font-display text-2xl font-semibold text-primary">
              {formatUsd(disbursed || total)}
            </span>
          </div>

          {total > 0 ? (
            <>
              <div className="mt-7 flex h-2.5 overflow-hidden rounded-full">
                {allocation.map((a) => (
                  <span
                    key={a.label}
                    className={a.tone}
                    style={{ width: `${(a.amount / total) * 100}%` }}
                  />
                ))}
              </div>

              <ul className="mt-7 space-y-4">
                {allocation.map((a) => (
                  <li key={a.label} className="flex items-center gap-3 text-sm">
                    <span className={`h-2 w-2 rounded-full ${a.tone}`} />
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className="ml-auto font-medium">{formatUsd(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-7 text-sm text-muted-foreground">
              Upload your labor contract to disburse a salary-backed credit line.
            </p>
          )}

          <div className="mt-8 space-y-2 border-t border-border pt-6">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Repayment cycle</span>
              <span className="text-foreground">18 of 30 days</span>
            </div>
            <Progress value={60} />
          </div>

          {(holdingsQuery.data?.length ?? 0) > 0 && (
            <div className="mt-8 space-y-3 border-t border-border pt-6">
              <h3 className="text-sm font-semibold">Active holdings</h3>
              <ul className="space-y-3">
                {holdingsQuery.data?.map((holding) => (
                  <li
                    key={holding.id}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2/30 p-3 text-sm"
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#00E599]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{holding.rumorSector}</span>
                        <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                          {holding.rumorId}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="h-3 w-3" />
                          Ticker hidden
                        </Badge>
                        <Badge className="border-[#00E599]/40 bg-[#00E599]/10 text-[#00E599] hover:bg-[#00E599]/10">
                          Locked
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatUsd(holding.totalAmount)} reserved · funds frozen until position opens
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {holding.allocations
                          .map((allocation) => `${allocation.gatewayName}: ${formatUsd(allocation.amount)}`)
                          .join(" · ")}
                      </p>
                      {holding.routedVenues && holding.routedVenues.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Routed: {holding.routedVenues.slice(0, 4).join(" · ")}
                          {holding.routedVenues.length > 4
                            ? ` · +${holding.routedVenues.length - 4} venues`
                            : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="secondary"
            className="mt-7 w-full"
            onClick={() => toast("Card repayment coming soon")}
          >
            Repay early
          </Button>
        </div>
      </div>
    </div>
  );
}
