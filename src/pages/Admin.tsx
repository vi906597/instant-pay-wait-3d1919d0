import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Lock, LogOut, RefreshCw, Search, Wallet, CheckCircle2, Clock, XCircle, IndianRupee,
  Upload, Trash2, Settings as SettingsIcon, QrCode,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PASSWORD_KEY = "admin_pwd";

type Payment = {
  id: string;
  order_id: string;
  email: string;
  customer_mobile: string;
  amount: number;
  status: string;
  utr: string | null;
  submitted_utr: string | null;
  submitted_at: string | null;
  assigned_upi: string | null;
  created_at: string;
};

type Stats = {
  total: number; success: number; pending: number; failed: number;
  sumSuccess: number; sumAll: number;
};

type Settings = { upi_id: string; payee_name: string; qr_mode: string; upi_ids: string[] };
type QrCodeRow = { id: string; amount: number; image_url: string };

const Admin = () => {
  const [password, setPassword] = useState(sessionStorage.getItem(PASSWORD_KEY) || "");
  const [authed, setAuthed] = useState(!!sessionStorage.getItem(PASSWORD_KEY));

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-payments${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          ...(init.headers || {}),
        },
      });
      if (res.status === 401) {
        toast({ title: "Wrong password", variant: "destructive" });
        sessionStorage.removeItem(PASSWORD_KEY);
        setAuthed(false);
        throw new Error("unauth");
      }
      return res.json();
    },
    [password],
  );

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full bg-gradient-card shadow-elevated">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Lock className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Admin Access</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter the admin password
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!password) return;
              sessionStorage.setItem(PASSWORD_KEY, password);
              setAuthed(true);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="pwd">Password</Label>
              <Input id="pwd" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-12 mt-2" autoFocus />
            </div>
            <Button type="submit" className="w-full h-12 bg-gradient-primary shadow-glow">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Payments dashboard</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            sessionStorage.removeItem(PASSWORD_KEY); setAuthed(false); setPassword("");
          }}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="payments"><Wallet className="w-4 h-4 mr-2" />Payments</TabsTrigger>
            <TabsTrigger value="qr"><QrCode className="w-4 h-4 mr-2" />QR Codes</TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-2" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="payments"><PaymentsTab call={call} /></TabsContent>
          <TabsContent value="qr"><QrTab call={call} /></TabsContent>
          <TabsContent value="settings"><SettingsTab call={call} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// ============= PAYMENTS TAB =============
const PaymentsTab = ({ call }: { call: (p: string, i?: RequestInit) => Promise<any> }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search) params.set("search", search);
      const data = await call(`?${params.toString()}`);
      setPayments(data.payments || []);
      setStats(data.stats || null);
    } catch (e: any) {
      if (e.message !== "unauth") toast({ title: "Load failed", description: String(e), variant: "destructive" });
    } finally { setLoading(false); }
  }, [filter, search, call]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  const setStatus = async (order_id: string, status: string, utr?: string) => {
    try {
      await call(`?action=set-status`, {
        method: "POST",
        body: JSON.stringify({ order_id, status, utr }),
      });
      toast({ title: `Marked ${status}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Total" value={stats.total.toString()} tone="primary" />
          <StatCard icon={CheckCircle2} label="Success" value={stats.success.toString()} tone="success" />
          <StatCard icon={Clock} label="Pending" value={stats.pending.toString()} tone="warning" />
          <StatCard icon={IndianRupee} label="Collected" value={`₹${stats.sumSuccess.toLocaleString("en-IN")}`} tone="primary" />
        </div>
      )}

      <Card className="p-4 bg-gradient-card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search email, order ID, UTR, mobile..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="md:w-48 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchData} disabled={loading} variant="outline" className="h-11">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email / Mobile</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User UTR</TableHead>
                <TableHead>UPI ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No payments</TableCell></TableRow>
              ) : payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    <div>{p.email}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.customer_mobile}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    ₹{Number(p.amount).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{p.submitted_utr || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.assigned_upi || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    {p.status === "PENDING" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-8"
                          onClick={() => setStatus(p.order_id, "SUCCESS", p.submitted_utr || undefined)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-8"
                          onClick={() => setStatus(p.order_id, "FAILED")}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8"
                        onClick={() => setStatus(p.order_id, "PENDING")}>Reset</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

// ============= QR TAB =============
const QrTab = ({ call }: { call: (p: string, i?: RequestInit) => Promise<any> }) => {
  const [qrs, setQrs] = useState<QrCodeRow[]>([]);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call(`?action=config`);
      setQrs(data.qr_codes || []);
    } catch {}
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1) {
      toast({ title: "Enter amount", variant: "destructive" }); return;
    }
    if (!file) {
      toast({ title: "Choose a QR image", variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const b64 = btoa(bin);
      const res = await call(`?action=upsert-qr`, {
        method: "POST",
        body: JSON.stringify({ amount: amt, image_base64: b64, content_type: file.type }),
      });
      if (res.error) throw new Error(res.error);
      toast({ title: "QR uploaded" });
      setAmount(""); setFile(null);
      (document.getElementById("qr-file") as HTMLInputElement).value = "";
      load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    } finally { setUploading(false); }
  };

  const remove = async (amount: number) => {
    if (!confirm(`Delete QR for ₹${amount}?`)) return;
    try {
      await call(`?action=delete-qr`, { method: "POST", body: JSON.stringify({ amount }) });
      toast({ title: "Deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card">
        <h3 className="font-semibold mb-1">Upload QR for an amount</h3>
        <p className="text-xs text-muted-foreground mb-4">
          When QR Mode is set to "Uploaded", users paying this amount will see this QR.
        </p>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100" className="h-11 font-mono" />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>QR Image</Label>
            <Input id="qr-file" type="file" accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)} className="h-11" />
          </div>
          <Button onClick={upload} disabled={uploading} className="h-11 bg-gradient-primary">
            <Upload className="w-4 h-4 mr-2" />{uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Uploaded QR codes</h3>
        {qrs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No QR codes uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {qrs.map((q) => (
              <div key={q.id} className="border border-border rounded-xl p-3 bg-background">
                <div className="aspect-square bg-white rounded-lg overflow-hidden mb-2">
                  <img src={q.image_url} alt={`QR ${q.amount}`} className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold">₹{Number(q.amount).toLocaleString("en-IN")}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(q.amount)}
                    className="h-8 w-8 p-0 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============= SETTINGS TAB =============
const SettingsTab = ({ call }: { call: (p: string, i?: RequestInit) => Promise<any> }) => {
  const [s, setS] = useState<Settings>({ upi_id: "", payee_name: "", qr_mode: "auto" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call(`?action=config`);
      if (data.settings) setS(data.settings);
    } catch {}
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await call(`?action=update-settings`, { method: "POST", body: JSON.stringify(s) });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-6 max-w-2xl bg-gradient-card">
      <h3 className="font-semibold mb-4">Payment settings</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>QR Mode</Label>
          <Select value={s.qr_mode} onValueChange={(v) => setS({ ...s, qr_mode: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-generate (UPI QR for any amount)</SelectItem>
              <SelectItem value="uploaded">Use uploaded QR per amount</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            <strong>Auto:</strong> generates a UPI QR with the entered amount paid to your UPI ID.{" "}
            <strong>Uploaded:</strong> shows the QR you uploaded in the QR Codes tab for that exact amount.
          </p>
        </div>

        <div className="space-y-2">
          <Label>UPI ID (for auto-generated QR)</Label>
          <Input value={s.upi_id} onChange={(e) => setS({ ...s, upi_id: e.target.value })}
            placeholder="9065978244@upi" className="h-11 font-mono" />
        </div>

        <div className="space-y-2">
          <Label>Payee name</Label>
          <Input value={s.payee_name} onChange={(e) => setS({ ...s, payee_name: e.target.value })}
            placeholder="ZYPEUS" className="h-11" />
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-12 bg-gradient-primary shadow-glow">
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </Card>
  );
};

// ============= helpers =============
const StatCard = ({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: string; tone: "primary" | "success" | "warning";
}) => {
  const toneClass = tone === "success" ? "bg-success/10 text-success"
    : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";
  return (
    <Card className="p-5 bg-gradient-card">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </Card>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return (
    <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
      <CheckCircle2 className="w-3 h-3 mr-1" />Success
    </Badge>
  );
  if (s === "FAILED" || s === "EXPIRED") return (
    <Badge variant="outline" className="border-destructive text-destructive">
      <XCircle className="w-3 h-3 mr-1" />{s}
    </Badge>
  );
  return (
    <Badge variant="outline" className="border-warning text-warning">
      <Clock className="w-3 h-3 mr-1" />Pending
    </Badge>
  );
};

export default Admin;
