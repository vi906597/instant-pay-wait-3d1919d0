import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminPassword = req.headers.get("x-admin-password");
    const expected = Deno.env.get("ADMIN_PASSWORD");
    if (!expected || adminPassword !== expected) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // ------------- READ: list payments -------------
    if (req.method === "GET" && action === "list") {
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search");

      let query = supabase
        .from("payments")
        .select(
          "id,order_id,email,customer_mobile,amount,status,utr,submitted_utr,submitted_at,created_at,updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (status && status !== "ALL") query = query.eq("status", status);
      if (search)
        query = query.or(
          `email.ilike.%${search}%,order_id.ilike.%${search}%,utr.ilike.%${search}%,submitted_utr.ilike.%${search}%,customer_mobile.ilike.%${search}%`,
        );

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);

      const { data: stats } = await supabase.from("payments").select("status,amount");
      const totals = { total: 0, success: 0, pending: 0, failed: 0, sumSuccess: 0, sumAll: 0 };
      (stats || []).forEach((r: any) => {
        totals.total++;
        totals.sumAll += Number(r.amount || 0);
        const s = String(r.status).toUpperCase();
        if (s === "SUCCESS") {
          totals.success++;
          totals.sumSuccess += Number(r.amount || 0);
        } else if (s === "FAILED" || s === "EXPIRED") totals.failed++;
        else totals.pending++;
      });

      return json({ payments: data, stats: totals });
    }

    // ------------- READ: settings + qr codes -------------
    if (req.method === "GET" && action === "config") {
      const { data: settings } = await supabase
        .from("payment_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      const { data: qrs } = await supabase
        .from("qr_codes")
        .select("*")
        .order("amount", { ascending: true });
      return json({ settings, qr_codes: qrs || [] });
    }

    // ------------- WRITE actions -------------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // Mark a payment success / failed
      if (action === "set-status") {
        const { order_id, status, utr } = body;
        if (!order_id || !status) return json({ error: "order_id + status required" }, 400);
        const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
        if (utr) update.utr = utr;
        const { error } = await supabase.from("payments").update(update).eq("order_id", order_id);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      // Update settings
      if (action === "update-settings") {
        const { upi_id, payee_name, qr_mode, upi_ids } = body;
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (upi_id) update.upi_id = upi_id;
        if (payee_name) update.payee_name = payee_name;
        if (qr_mode) update.qr_mode = qr_mode;
        if (Array.isArray(upi_ids)) update.upi_ids = upi_ids;
        const { data: existing } = await supabase
          .from("payment_settings")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          const { error } = await supabase
            .from("payment_settings")
            .update(update)
            .eq("id", existing.id);
          if (error) return json({ error: error.message }, 500);
        } else {
          const { error } = await supabase.from("payment_settings").insert(update);
          if (error) return json({ error: error.message }, 500);
        }
        return json({ success: true });
      }

      // Upsert QR code: { amount, image_base64, content_type }
      if (action === "upsert-qr") {
        const { amount, image_base64, content_type } = body;
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt < 1) return json({ error: "Invalid amount" }, 400);
        if (!image_base64) return json({ error: "Image required" }, 400);

        const bin = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
        const ext = (content_type || "image/png").split("/")[1] || "png";
        const path = `amount-${amt}-${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("qr-codes")
          .upload(path, bin, { contentType: content_type || "image/png", upsert: true });
        if (upErr) return json({ error: upErr.message }, 500);

        const { data: pub } = supabase.storage.from("qr-codes").getPublicUrl(path);
        const image_url = pub.publicUrl;

        const { error } = await supabase
          .from("qr_codes")
          .upsert({ amount: amt, image_url }, { onConflict: "amount" });
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, image_url });
      }

      // Delete QR
      if (action === "delete-qr") {
        const { amount } = body;
        const { error } = await supabase.from("qr_codes").delete().eq("amount", Number(amount));
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
