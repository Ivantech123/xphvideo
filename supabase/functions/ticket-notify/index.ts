import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

type NotifyEvent = "created" | "updated";

type Body = {
  event: NotifyEvent;
  ticketId: string;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    },
  });

const sendResendEmail = async (opts: { to: string; subject: string; html: string }) => {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM") || "Velvet <no-reply@velvet.run>";
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Resend error: ${r.status} ${txt}`);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.event || !body?.ticketId) {
      return json(400, { error: "Missing event or ticketId" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "abloko362@gmail.com";

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", body.ticketId)
      .single();

    if (error || !ticket) {
      return json(404, { error: error?.message || "Ticket not found" });
    }

    const safe = (s: unknown) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const status = safe(ticket.status);
    const type = safe(ticket.type);
    const subject = safe(ticket.subject);
    const message = safe(ticket.message);
    const videoTitle = safe(ticket.video_title);
    const pageUrl = safe(ticket.page_url);
    const userEmail = safe(ticket.user_email);

    if (body.event === "created") {
      await sendResendEmail({
        to: adminEmail,
        subject: `[Velvet] New ticket: ${type} / ${status}`,
        html: `
          <div style="font-family: ui-sans-serif, system-ui; line-height: 1.4">
            <h2>New ticket</h2>
            <p><b>Status:</b> ${status}</p>
            <p><b>Type:</b> ${type}</p>
            <p><b>User:</b> ${userEmail || "(unknown)"}</p>
            <p><b>Video:</b> ${videoTitle || "—"}</p>
            <p><b>Subject:</b> ${subject || "—"}</p>
            <pre style="background:#111;color:#eee;padding:12px;border-radius:8px;white-space:pre-wrap">${message || ""}</pre>
            <p><b>Page:</b> <a href="${pageUrl}">${pageUrl}</a></p>
            <p><b>Ticket ID:</b> ${safe(ticket.id)}</p>
          </div>
        `,
      });

      return json(200, { ok: true });
    }

    // updated
    if (ticket.user_email) {
      await sendResendEmail({
        to: ticket.user_email,
        subject: `[Velvet] Ticket update: ${status}`,
        html: `
          <div style="font-family: ui-sans-serif, system-ui; line-height: 1.4">
            <h2>Your ticket was updated</h2>
            <p><b>Status:</b> ${status}</p>
            <p><b>Subject:</b> ${subject || "—"}</p>
            ${ticket.admin_notes ? `<p><b>Support reply:</b></p><pre style="background:#111;color:#eee;padding:12px;border-radius:8px;white-space:pre-wrap">${safe(ticket.admin_notes)}</pre>` : ""}
            <p><b>Ticket ID:</b> ${safe(ticket.id)}</p>
          </div>
        `,
      });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
