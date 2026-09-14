import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

async function sendToUser(userId: string, payload: Record<string, unknown>) {
  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) throw error;
  if (!subscriptions?.length) {
    return { sent: 0, failed: 0, noSubscriptions: true };
  }

  let sent = 0;
  let failed = 0;

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify(payload),
        { TTL: 3600, urgency: "normal" },
      );
      sent++;

      await supabaseAdmin
        .from("push_subscriptions")
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } catch (error: any) {
      failed++;
      console.error("Web Push gönderim hatası:", {
        statusCode: error?.statusCode,
        body: error?.body,
      });

      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", row.id);
      }
    }
  }

  return { sent, failed, noSubscriptions: false };
}

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

async function isAuthorizedCronRequest(req: Request) {
  const supplied = req.headers.get("x-cron-secret") || "";
  if (!supplied) return false;

  const legacySecret = Deno.env.get("PUSH_CRON_SECRET") || "";
  if (legacySecret && supplied === legacySecret) return true;

  const { data, error } = await supabaseAdmin.rpc("verify_push_dispatch_secret", {
    p_secret: supplied,
  });

  if (error) {
    console.error("Push cron secret doğrulanamadı:", error.message);
    return false;
  }

  return data === true;
}

function normalizeParcelGeometry(raw: any) {
  if (!raw) return null;
  if (raw.type === "Feature" && raw.geometry) return raw;

  const geometry = raw.geometry ?? raw;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(String(geometry.type))) {
    return null;
  }

  return { type: "Feature", properties: {}, geometry };
}

async function getLatestSentinel2Scene(parcelGeometry: any, daysBack: number) {
  const geometry = normalizeParcelGeometry(parcelGeometry);
  if (!geometry) return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/sentinel2-latest-date`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      geometry,
      daysBack,
      maxCloudCoverage: 30,
    }),
  });

  if (!response.ok) throw new Error(`sentinel2-latest-date ${response.status}`);

  const data = await response.json();
  if (!data?.success || !data?.latestImageDate) return null;

  return {
    date: String(data.latestImageDate),
    sceneId: data.sceneId ? String(data.sceneId) : null,
    cloudCoverage: Number.isFinite(Number(data.cloudCoverage))
      ? Number(data.cloudCoverage)
      : null,
  };
}

function trDate(value: string) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

async function processNdviMapUpdates(force = false) {
  const { data: subscriptionRows, error: subscriptionError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id")
    .eq("enabled", true)
    .limit(500);

  if (subscriptionError) throw subscriptionError;

  const userIds = Array.from(
    new Set(
      (subscriptionRows ?? [])
        .map((row: any) => String(row.user_id ?? ""))
        .filter(Boolean),
    ),
  );

  if (!userIds.length) {
    return { checked: 0, notified: 0, seeded: 0, skipped: 0, failed: 0 };
  }

  const { data: fields, error: fieldError } = await supabaseAdmin
    .from("fields")
    .select("id,user_id,name,parcel_geometry")
    .in("user_id", userIds)
    .not("parcel_geometry", "is", null)
    .limit(500);

  if (fieldError) throw fieldError;
  if (!fields?.length) {
    return { checked: 0, notified: 0, seeded: 0, skipped: 0, failed: 0 };
  }

  const fieldIds = fields.map((field: any) => String(field.id));
  const { data: stateRows, error: stateError } = await supabaseAdmin
    .from("field_satellite_notification_state")
    .select("user_id,field_id,last_scene_date,last_scene_id,last_notified_scene_date,last_checked_at")
    .in("field_id", fieldIds);

  if (stateError) throw stateError;

  const stateByField = new Map<string, any>(
    (stateRows ?? []).map((row: any) => [String(row.field_id), row]),
  );

  const now = Date.now();
  const minCheckIntervalMs = 4 * 60 * 60 * 1000;

  const eligible = fields
    .map((field: any) => {
      const state = stateByField.get(String(field.id)) ?? null;
      const lastCheckedAt = state?.last_checked_at
        ? new Date(state.last_checked_at).getTime()
        : 0;
      return { field, state, lastCheckedAt };
    })
    .filter((item: any) => {
      if (force) return true;
      if (!Number.isFinite(item.lastCheckedAt) || item.lastCheckedAt <= 0) return true;
      return now - item.lastCheckedAt >= minCheckIntervalMs;
    })
    .sort((a: any, b: any) => (a.lastCheckedAt || 0) - (b.lastCheckedAt || 0))
    .slice(0, 20);

  const skipped = Math.max(0, fields.length - eligible.length);

  async function processOne(item: any) {
    const field = item.field;
    const state = item.state;
    const fieldId = String(field.id);
    const userId = String(field.user_id);

    try {
      const daysBack = state?.last_scene_date ? 45 : 180;
      const latest = await getLatestSentinel2Scene(field.parcel_geometry, daysBack);
      const checkedAt = new Date().toISOString();

      if (!latest) {
        await supabaseAdmin
          .from("field_satellite_notification_state")
          .upsert({
            user_id: userId,
            field_id: fieldId,
            last_checked_at: checkedAt,
            last_error: null,
            updated_at: checkedAt,
          }, { onConflict: "user_id,field_id" });
        return "checked";
      }

      if (!state?.last_scene_date) {
        await supabaseAdmin
          .from("field_satellite_notification_state")
          .upsert({
            user_id: userId,
            field_id: fieldId,
            last_scene_date: latest.date,
            last_scene_id: latest.sceneId,
            last_notified_scene_date: latest.date,
            last_checked_at: checkedAt,
            last_error: null,
            updated_at: checkedAt,
          }, { onConflict: "user_id,field_id" });
        return "seeded";
      }

      const lastNotified = String(
        state.last_notified_scene_date ?? state.last_scene_date ?? "",
      );
      const isNewer = latest.date > lastNotified;

      if (!isNewer) {
        await supabaseAdmin
          .from("field_satellite_notification_state")
          .upsert({
            user_id: userId,
            field_id: fieldId,
            last_scene_date: latest.date,
            last_scene_id: latest.sceneId,
            last_checked_at: checkedAt,
            last_error: null,
            updated_at: checkedAt,
          }, { onConflict: "user_id,field_id" });
        return "checked";
      }

      const result = await sendToUser(userId, {
        title: "Yeni haritan hazır 🌿",
        body: `${String(field.name ?? "Tarlan")} için ${trDate(latest.date)} tarihli yeni NDVI haritası hazır.`,
        tag: `ndvi-${fieldId}-${latest.date}`,
        url: `/?open=ndvi&fieldId=${encodeURIComponent(fieldId)}`,
        fieldId,
        source: "satellite",
        satelliteDate: latest.date,
      });

      await supabaseAdmin
        .from("field_satellite_notification_state")
        .upsert({
          user_id: userId,
          field_id: fieldId,
          last_scene_date: latest.date,
          last_scene_id: latest.sceneId,
          last_notified_scene_date: result.sent > 0 ? latest.date : lastNotified || null,
          last_checked_at: checkedAt,
          last_error:
            result.sent > 0
              ? null
              : result.noSubscriptions
                ? "no_active_subscription"
                : "push_send_failed",
          updated_at: checkedAt,
        }, { onConflict: "user_id,field_id" });

      return result.sent > 0 ? "notified" : "failed";
    } catch (error) {
      const checkedAt = new Date().toISOString();
      console.error("NDVI push kontrolü başarısız:", fieldId, error);

      await supabaseAdmin
        .from("field_satellite_notification_state")
        .upsert({
          user_id: userId,
          field_id: fieldId,
          last_checked_at: checkedAt,
          last_error:
            error instanceof Error ? error.message.slice(0, 500) : "ndvi_check_failed",
          updated_at: checkedAt,
        }, { onConflict: "user_id,field_id" });
      return "failed";
    }
  }

  const results: string[] = [];
  const concurrency = 4;
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency);
    results.push(...await Promise.all(chunk.map(processOne)));
  }

  return {
    checked: results.length,
    notified: results.filter((item) => item === "notified").length,
    seeded: results.filter((item) => item === "seeded").length,
    skipped,
    failed: results.filter((item) => item === "failed").length,
    forced: force,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.test === true) {
      const user = await getRequestUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Oturum gerekli." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await sendToUser(user.id, {
        title: "TarlaPusula test bildirimi",
        body: "Telefon bildirimi başarıyla çalışıyor.",
        tag: "tarlapusula-test",
        url: "/",
      });

      return new Response(
        JSON.stringify({
          ok: result.sent > 0,
          ...result,
          error: result.sent > 0 ? null : "Aktif push aboneliği bulunamadı.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!(await isAuthorizedCronRequest(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized cron request." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.ndviOnly === true) {
      const ndvi = await processNdviMapUpdates(body?.force === true);
      return new Response(JSON.stringify({ ok: true, processedReminders: 0, ndvi }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: jobs, error: jobsError } = await supabaseAdmin.rpc(
      "claim_due_push_reminders",
      { p_limit: 50 },
    );
    if (jobsError) throw jobsError;

    const reminderResults = [];
    for (const job of jobs ?? []) {
      const timeText = job.reminder_time ? String(job.reminder_time).slice(0, 5) : "";
      const result = await sendToUser(job.user_id, {
        title: `TarlaPusula • ${job.reminder_type}`,
        body: `${job.field_name}: ${job.title}${timeText ? ` • ${timeText}` : ""}`,
        tag: `reminder-${job.id}`,
        reminderId: job.id,
        url: "/",
      });

      if (result.sent > 0) {
        await supabaseAdmin
          .from("calendar_reminders")
          .update({ push_sent_at: new Date().toISOString(), push_claimed_at: null, push_error: null })
          .eq("id", job.id);
      } else {
        await supabaseAdmin
          .from("calendar_reminders")
          .update({
            push_claimed_at: null,
            push_error: result.noSubscriptions ? "no_active_subscription" : "push_send_failed",
          })
          .eq("id", job.id);
      }

      reminderResults.push({ reminderId: job.id, ...result });
    }

    const ndvi = await processNdviMapUpdates(false);

    return new Response(
      JSON.stringify({
        ok: true,
        processedReminders: reminderResults.length,
        reminderResults,
        ndvi,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-due-reminders error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Push gönderiminde hata oluştu.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});