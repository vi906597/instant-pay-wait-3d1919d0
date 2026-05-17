import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Shield, Zap, Wallet, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PRESET_AMOUNTS = [100, 500, 1000, 2000, 2500, 5000];

const Index = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    const finalAmount = custom ? Number(custom) : Number(amount);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast({ title: "Enter a valid 10-digit mobile", variant: "destructive" });
      return;
    }
    if (!finalAmount || finalAmount < 1) {
      toast({ title: "Select or enter an amount", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const order_id = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const { error } = await supabase.from("payments").insert({
        order_id,
        email,
        customer_mobile: mobile,
        amount: finalAmount,
        status: "PENDING",
      });
      if (error) {
        toast({ title: "Failed to create order", description: error.message, variant: "destructive" });
        return;
      }
      navigate(`/status/${order_id}`);
    } catch (e: any) {
      toast({ title: "Network error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              ZY<span className="text-gradient">PEUS</span>
            </span>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" /> Instant UPI Payments
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
          Pay in seconds with ZY<span className="text-gradient">PEUS</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
          Scan QR with any UPI app. Submit your UTR after paying.
        </p>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <Card className="max-w-2xl mx-auto p-6 md:p-10 bg-gradient-card shadow-elevated border-border/50">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-sm font-semibold">Mobile number</Label>
              <Input id="mobile" type="tel" inputMode="numeric" maxLength={10}
                placeholder="10-digit mobile" value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-base font-mono" />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Choose amount</Label>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AMOUNTS.map((a) => {
                  const active = amount === a && !custom;
                  return (
                    <button key={a} type="button"
                      onClick={() => { setAmount(a); setCustom(""); }}
                      className={`relative rounded-xl border-2 p-4 text-center transition-smooth ${
                        active ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border hover:border-primary/50 bg-card"
                      }`}>
                      <div className="text-lg font-bold">₹{a.toLocaleString()}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                <Input type="number" min={1} placeholder="Custom amount" value={custom}
                  onChange={(e) => { setCustom(e.target.value); setAmount(""); }}
                  className="h-12 pl-8 text-base font-mono" />
              </div>
            </div>

            <Button onClick={handlePay} disabled={loading}
              className="w-full h-14 text-base font-semibold bg-gradient-primary hover:opacity-90 shadow-glow">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
                <>Pay Now <ArrowRight className="w-5 h-5 ml-1" /></>}
            </Button>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[{ icon: Shield, label: "Secure" }, { icon: Zap, label: "Instant" }, { icon: Wallet, label: "UPI" }].map((f) => (
                <div key={f.label} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <f.icon className="w-4 h-4 text-primary" />{f.label}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Index;
