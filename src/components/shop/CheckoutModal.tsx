import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatUsd } from "@/lib/pivoton-erp";
import type { ErpInventoryItem, PaymentMethod, ShippingInfo } from "@/types/erp";

interface CheckoutModalProps {
  product: ErpInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance?: number;
  onConfirm: (input: {
    shipping_info: ShippingInfo;
    payment_method: PaymentMethod;
    total_amount: number;
  }) => Promise<void>;
}

const EMPTY_SHIPPING: ShippingInfo = {
  full_name: "",
  shipping_address: "",
  city: "",
  phone_number: "",
};

export function CheckoutModal({
  product,
  open,
  onOpenChange,
  onConfirm,
  availableBalance,
}: CheckoutModalProps) {
  const [shipping, setShipping] = useState<ShippingInfo>(EMPTY_SHIPPING);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pivoton_balance");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setShipping(EMPTY_SHIPPING);
    setPaymentMethod("pivoton_balance");
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmitting(true);
    try {
      await onConfirm({
        shipping_info: shipping,
        payment_method: paymentMethod,
        total_amount: product.unit_price,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-border bg-[#121824] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Checkout</DialogTitle>
          <DialogDescription>
            {product
              ? `Complete your purchase for ${product.title}. Cashback ${product.cashback_percent}% applies after delivery.`
              : "Review shipping and payment details."}
          </DialogDescription>
        </DialogHeader>

        {product && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg border border-border bg-[#0B0E14] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{product.title}</p>
                  <p className="text-xs text-muted-foreground">{product.pivoton_sku}</p>
                </div>
                <p className="font-display text-lg font-semibold text-primary">
                  {formatUsd(product.unit_price)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  required
                  value={shipping.full_name}
                  onChange={(e) => setShipping((s) => ({ ...s, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shipping_address">Shipping address</Label>
                <Input
                  id="shipping_address"
                  required
                  value={shipping.shipping_address}
                  onChange={(e) =>
                    setShipping((s) => ({ ...s, shipping_address: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  required
                  value={shipping.city}
                  onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone number</Label>
                <Input
                  id="phone_number"
                  required
                  type="tel"
                  value={shipping.phone_number}
                  onChange={(e) => setShipping((s) => ({ ...s, phone_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Payment method</Label>
                {availableBalance !== undefined && (
                  <span className="text-xs text-primary">
                    Available: {formatUsd(availableBalance)}
                  </span>
                )}
              </div>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                className="grid gap-2"
              >
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-[#0B0E14] px-4 py-3">
                  <RadioGroupItem value="pivoton_balance" />
                  <span className="text-sm">Pivoton Balance</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-[#0B0E14] px-4 py-3">
                  <RadioGroupItem value="credit" />
                  <span className="text-sm">Credit line</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-[#0B0E14] px-4 py-3">
                  <RadioGroupItem value="nfc" />
                  <span className="text-sm">NFC tap-to-pay</span>
                </label>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing order…
                  </>
                ) : (
                  "Confirm & place order"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
