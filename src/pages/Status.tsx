import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, XCircle, Loader2, ArrowLeft, RefreshCw, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Payment = {
  order_id: string;
  email: string;
  customer_mobile: string;
  amount: number;
  status: string;
  utr: string | null;
  submitted_utr: string | null;
  assigned_upi: string | null;
  created_at: string;
  updated_at: string;
};

type Settings = { upi_id: string; payee_name: string; qr_mode: string };

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "SUCCESS") return <CheckCircle2 className="w-16 h-16 text-success" strokeWidth={1.5} />;
  if (status === "FAILED" || status === "EXPIRED") return <XCircle className="w-16 h-16 text-destructive" strokeWidth={1.5} />;
  return <Clock className="w-16 h-16 text-warning animate-pulse" strokeWidth={1.5} />;
};

const StatusPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null); // data URL or uploaded URL
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [utrInput, setUtrInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (!orderId) return;
    if (showSpinner) setRefreshing(true);
    try {
      const [{ data: pay }, { data: setRows }] = await Promise.all([
        supabase.from("payments").select("*").eq("order_id", orderId).maybeSingle(),
        supabase.from("payment_settings").select("*").limit(1).maybeSingle(),
      ]);
      if (pay) setPayment(pay as Payment);
      if (setRows) setSettings(setRows as Settings);

      if (pay && setRows && (pay as Payment).status === "PENDING") {
        const amt = Number((pay as Payment).amount);
        if ((setRows as Settings).qr_mode === "uploaded") {
          const { data: qr } = await supabase
            .from("qr_codes").select("image_url").eq("amount", amt).maybeSingle();
          setQrImage(qr?.image_url || null);
        } else {
          const upiId = (pay as Payment).assigned_upi || (setRows as Settings).upi_id;
          const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent((setRows as Settings).payee_name)}&am=${amt}&cu=INR&tn=${encodeURIComponent((pay as Payment).order_id)}`;
          const dataUrl = await QRCode.toDataURL(upi, { width: 320, margin: 1 });
          setQrImage(dataUrl);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchAll();
    const i = setInterval(() => fetchAll(), 15000);
    return () => clearInterval(i);
  }, [fetchAll]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  const submitUtr = async () => {
    if (!payment) return;
    if (!/^[A-Za-z0-9]{8,30}$/.test(utrInput.trim())) {
      toast({ title: "Enter a valid UTR / reference number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("payments")
      .update({ submitted_utr: utrInput.trim(), submitted_at: new Date().toISOString() })
      .eq("order_id", payment.order_id)
      .eq("status", "PENDING");
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "UTR submitted", description: "Admin will verify and confirm." });
    fetchAll(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Order not found</h2>
          <Link to="/"><Button>Back home</Button></Link>
        </Card>
      </div>
    );
  }

  const status = payment.status.toUpperCase();
  const isPending = status === "PENDING";
  const hasSubmittedUtr = !!payment.submitted_utr;

  return (
    <div className="min-h-screen bg-gradient-subtle py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-smooth">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <Card className="p-6 md:p-10 bg-gradient-card shadow-elevated text-center">
          <div className="flex justify-center mb-4"><StatusIcon status={status} /></div>

          <Badge variant="outline" className={`mb-3 ${
            status === "SUCCESS" ? "border-success text-success"
              : status === "FAILED" || status === "EXPIRED" ? "border-destructive text-destructive"
                : "border-warning text-warning"
          }`}>{status}</Badge>

          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {status === "SUCCESS" ? "Payment Successful 🎉"
              : status === "FAILED" ? "Payment Failed"
                : status === "EXPIRED" ? "Payment Expired"
                  : hasSubmittedUtr ? "Awaiting Confirmation" : "Scan to Pay"}
          </h1>

          <p className="text-3xl font-extrabold text-gradient mb-6 font-mono">
            ₹{Number(payment.amount).toLocaleString("en-IN")}
          </p>

          {isPending && qrImage && !hasSubmittedUtr && (
            <div className="mb-6">
              <div className="inline-block p-4 bg-white rounded-2xl shadow-elevated">
                <img src={qrImage} alt="UPI QR" className="w-64 h-64 object-contain" />
              </div>
              {settings?.qr_mode === "auto" && (() => {
                const upiId = payment.assigned_upi || settings.upi_id;
                return (
                  <div className="mt-3 text-sm">
                    <p className="text-muted-foreground">Pay to UPI ID</p>
                    <button onClick={() => copy(upiId)}
                      className="inline-flex items-center gap-2 font-mono font-semibold text-primary hover:underline">
                      {upiId} <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-3">
                Open any UPI app (GPay / PhonePe / Paytm) → Scan this QR → Pay exactly ₹{Number(payment.amount).toLocaleString("en-IN")}
              </p>
            </div>
          )}

          {isPending && !qrImage && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 text-sm text-destructive">
              No QR available for this amount yet. Please contact support.
            </div>
          )}

          {isPending && qrImage && !hasSubmittedUtr && (
            <div className="text-left space-y-3 mb-6">
              <Label htmlFor="utr" className="text-sm font-semibold">After paying, enter UTR / UPI Ref ID</Label>
              <Input id="utr" value={utrInput} onChange={(e) => setUtrInput(e.target.value)}
                placeholder="12-digit UTR from your UPI app" className="h-12 font-mono" />
              <Button onClick={submitUtr} disabled={submitting} className="w-full h-12 bg-gradient-primary shadow-glow">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "I have paid — Submit UTR"}
              </Button>
            </div>
          )}

          {isPending && hasSubmittedUtr && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold mb-1">⏳ UTR submitted — awaiting admin confirmation</p>
              <p className="text-xs text-muted-foreground">
                Usually confirmed within a few minutes. This page auto-refreshes.
              </p>
            </div>
          )}

          {(payment.submitted_utr || payment.utr) && (
            <div className="text-left bg-muted/50 rounded-xl p-4 space-y-3 mb-6">
              {payment.submitted_utr && <Row label="Your UTR" value={payment.submitted_utr} />}
              {payment.utr && <Row label="Verified UTR" value={payment.utr} onCopy={() => copy(payment.utr!)} />}
            </div>
          )}

          <Button onClick={() => fetchAll(true)} disabled={refreshing} variant="outline" className="w-full h-12">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh status
          </Button>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className="truncate max-w-[200px]">{value}</span>
      {onCopy && (
        <button onClick={onCopy} className="text-muted-foreground hover:text-foreground">
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
);

export default StatusPage;
