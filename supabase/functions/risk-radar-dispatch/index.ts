import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  PERENNIAL_CROPS,
  RISK_LABELS_TR,
  THREATS,
  type RiskLevel,
  type ThreatDefinition,
} from '../risk-radar/catalog.ts';
import {
  aggregateDaily,
  computeFuzzyTimeline,
  computePowderyMildewTimeline,
  finite,
  normalizeCrop,
  peakFromToday,
  reasonsFor,
  trendFromTimeline,
  type DailyRisk,
  type HourlyRow,
} from '../risk-radar/risk-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'content-type, x-cron-secret',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ||
    'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;
const REPEAT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_FIELDS_PER_RUN = 20;
const CURRENT_ALERT_SCORE = 65;
const FORECAST_WATCH_SCORE = 30;
const FORECAST_ALERT_SCORE = 65;
const SCORE_ESCALATION_DELTA = 15;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function cleanDate(value: unknown) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

function dateMinusOne(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function riskRank(level: unknown) {
  if (level === 'critical') return 4;
  if (level === 'high') return 3;
  if (level === 'moderate') return 2;
  if (level === 'low') return 1;
  return 0;
}

async function isAuthorizedCronRequest(req: Request) {
  const supplied =
    req.headers.get('x-cron-secret') ?? '';

  if (!supplied) return false;

  const legacySecret =
    Deno.env.get('PUSH_CRON_SECRET') ?? '';

  if (
    legacySecret &&
    supplied === legacySecret
  ) {
    return true;
  }

  const { data, error } = await supabaseAdmin.rpc(
    'verify_push_dispatch_secret',
    {
      p_secret: supplied,
    },
  );

  if (error) {
    console.error(
      '[risk-radar-dispatch] cron secret:',
      error.message,
    );
    return false;
  }

  return data === true;
}

async function sendToUser(
  userId: string,
  payload: Record<string, unknown>,
  urgency: 'normal' | 'high' = 'normal',
) {
  const { data: subscriptions, error } =
    await supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', userId)
      .eq('enabled', true);

  if (error) throw error;

  if (!subscriptions?.length) {
    return {
      sent: 0,
      failed: 0,
      noSubscriptions: true,
    };
  }

  let sent = 0;
  let failed = 0;

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify(payload),
        {
          TTL: 6 * 60 * 60,
          urgency,
        },
      );
      sent += 1;

      await supabaseAdmin
        .from('push_subscriptions')
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } catch (error: any) {
      failed += 1;

      if (
        error?.statusCode === 404 ||
        error?.statusCode === 410
      ) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('id', row.id);
      }
    }
  }

  return {
    sent,
    failed,
    noSubscriptions: false,
  };
}

function resolveLocation(field: any) {
  const latitude = finite(
    field?.parcel_centroid_lat ?? field?.latitude,
  );
  const longitude = finite(
    field?.parcel_centroid_lng ?? field?.longitude,
  );

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

async function fetchHourlyWeather(
  latitude: number,
  longitude: number,
) {
  const url = new URL(
    'https://api.open-meteo.com/v1/forecast',
  );
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'vapour_pressure_deficit',
      'dew_point_2m',
      'wind_speed_10m',
    ].join(','),
  );
  url.searchParams.set('past_days', '7');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    20_000,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TarlaPusula-RiskRadar/1.1',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Open-Meteo ${response.status}: ${text.slice(0, 160)}`,
      );
    }

    const payload = JSON.parse(text);
    const hourly = payload?.hourly ?? {};
    const times = Array.isArray(hourly?.time)
      ? hourly.time
      : [];
    const rows: HourlyRow[] = [];

    for (let i = 0; i < times.length; i += 1) {
      const temperature = finite(
        hourly?.temperature_2m?.[i],
      );
      const humidity = finite(
        hourly?.relative_humidity_2m?.[i],
      );
      const precipitation = finite(
        hourly?.precipitation?.[i],
      );

      if (
        temperature === null ||
        humidity === null ||
        precipitation === null
      ) {
        continue;
      }

      rows.push({
        time: String(times[i]),
        temperature,
        humidity,
        precipitation,
        vpd: finite(
          hourly?.vapour_pressure_deficit?.[i],
        ),
        dewPoint: finite(
          hourly?.dew_point_2m?.[i],
        ),
        windSpeed: finite(
          hourly?.wind_speed_10m?.[i],
        ),
      });
    }

    if (!rows.length) {
      throw new Error(
        'Saatlik risk hava verisi bulunamadı.',
      );
    }

    return rows;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHistoricalGddSeed(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  baseTemp: number,
) {
  if (
    !startDate ||
    !endDate ||
    startDate > endDate
  ) {
    return 0;
  }

  let effectiveStart = startDate;

  if (daysBetween(startDate, endDate) > 370) {
    const end = new Date(`${endDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 370);
    effectiveStart = end.toISOString().slice(0, 10);
  }

  const url = new URL(
    'https://archive-api.open-meteo.com/v1/archive',
  );
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', effectiveStart);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set(
    'daily',
    'temperature_2m_mean',
  );
  url.searchParams.set('timezone', 'auto');

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;

    const payload = await response
      .json()
      .catch(() => ({}));

    const values = Array.isArray(
      payload?.daily?.temperature_2m_mean,
    )
      ? payload.daily.temperature_2m_mean
      : [];

    return values.reduce(
      (sum: number, value: unknown) => {
        const temperature = finite(value);
        return temperature === null
          ? sum
          : sum +
              Math.max(
                0,
                temperature - baseTemp,
              );
      },
      0,
    );
  } catch {
    return 0;
  }
}

function findTodayIndex(
  daily: Array<{ date: string }>,
  appDate: string,
) {
  let index = daily.findIndex(
    (item) => item.date === appDate,
  );

  if (index < 0) {
    index = daily.findIndex(
      (item) => item.date > appDate,
    );
  }

  return index < 0
    ? Math.max(0, daily.length - 7)
    : index;
}

async function buildThreat(
  threat: ThreatDefinition,
  daily: ReturnType<typeof aggregateDaily>,
  todayIndex: number,
  latitude: number,
  longitude: number,
  seasonStartDate: string,
) {
  const firstDate = daily[0]?.date ?? '';
  const historyEnd = firstDate
    ? dateMinusOne(firstDate)
    : '';

  const seedGdd = await fetchHistoricalGddSeed(
    latitude,
    longitude,
    seasonStartDate,
    historyEnd,
    threat.bio.tBase,
  );

  const timeline: DailyRisk[] =
    threat.specializedModel === 'grape_powdery_ucipm'
      ? computePowderyMildewTimeline(
          threat,
          daily,
          seedGdd,
        )
      : computeFuzzyTimeline(
          threat,
          daily,
          seedGdd,
        );

  const today = timeline[todayIndex] ?? timeline[0];
  const peak =
    peakFromToday(timeline, todayIndex) ?? today;
  const trend = trendFromTimeline(
    timeline,
    todayIndex,
  );

  return {
    displayName: threat.displayNameTr,
    score: today?.score ?? 0,
    level: (today?.level ?? 'low') as RiskLevel,
    peakScore7d: peak?.score ?? today?.score ?? 0,
    peakLevel7d: (peak?.level ??
      today?.level ??
      'low') as RiskLevel,
    peakDate: peak?.date ?? today?.date ?? null,
    trend,
    reasons: today
      ? reasonsFor(today, threat, trend)
      : [],
  };
}

async function calculateFieldRisk(field: any) {
  const crop = normalizeCrop(field?.crop);
  const location = resolveLocation(field);

  if (!crop) {
    return {
      supported: false as const,
      reason: 'unsupported_crop',
    };
  }

  if (!location) {
    return {
      supported: false as const,
      reason: 'missing_field_location',
    };
  }

  const threats = THREATS.filter(
    (item) => item.crop === crop,
  );

  if (!threats.length) {
    return {
      supported: false as const,
      reason: 'no_threat_model',
    };
  }

  const hourly = await fetchHourlyWeather(
    location.latitude,
    location.longitude,
  );
  const daily = aggregateDaily(hourly);

  if (daily.length < 3) {
    throw new Error(
      'Yeterli günlük risk verisi oluşmadı.',
    );
  }

  const appDate = new Date().toISOString().slice(0, 10);
  const todayIndex = findTodayIndex(daily, appDate);
  const seasonStartDate =
    PERENNIAL_CROPS.has(crop)
      ? `${(daily[todayIndex]?.date ?? appDate).slice(0, 4)}-01-01`
      : `${Number(field?.season ?? appDate.slice(0, 4))}-01-01`;

  const outputs = await Promise.all(
    threats.map((threat) =>
      buildThreat(
        threat,
        daily,
        todayIndex,
        location.latitude,
        location.longitude,
        seasonStartDate,
      ),
    ),
  );

  outputs.sort(
    (a, b) =>
      b.score - a.score ||
      b.peakScore7d - a.peakScore7d,
  );

  return {
    supported: true as const,
    appDate,
    top: outputs[0] ?? null,
  };
}

function notificationCandidate(
  result: Awaited<ReturnType<typeof calculateFieldRisk>>,
) {
  if (!result.supported || !result.top) {
    return null;
  }

  const top = result.top;
  const forecastLimit = addDays(result.appDate, 3);
  const currentAlert = top.score >= CURRENT_ALERT_SCORE;
  const forecastAlert =
    top.score >= FORECAST_WATCH_SCORE &&
    top.peakScore7d >= FORECAST_ALERT_SCORE &&
    Boolean(top.peakDate) &&
    String(top.peakDate) <= forecastLimit;

  if (!currentAlert && !forecastAlert) {
    return null;
  }

  return {
    ...top,
    kind: currentAlert
      ? ('current' as const)
      : ('forecast' as const),
    notifyScore: currentAlert
      ? top.score
      : top.peakScore7d,
    notifyLevel: currentAlert
      ? top.level
      : top.peakLevel7d,
  };
}

function shouldNotify(state: any, candidate: any) {
  if (!candidate) return false;

  if (!state?.last_notified_at) {
    return true;
  }

  if (
    String(state.last_notified_threat ?? '') !==
    candidate.displayName
  ) {
    return true;
  }

  if (
    riskRank(candidate.notifyLevel) >
    riskRank(state.last_notified_level)
  ) {
    return true;
  }

  const lastScore = Number(
    state.last_notified_score ?? 0,
  );

  if (
    candidate.notifyScore >=
    lastScore + SCORE_ESCALATION_DELTA
  ) {
    return true;
  }

  const lastAt = new Date(
    state.last_notified_at,
  ).getTime();

  return (
    Number.isFinite(lastAt) &&
    Date.now() - lastAt >= REPEAT_COOLDOWN_MS &&
    candidate.notifyScore >= CURRENT_ALERT_SCORE
  );
}

function notificationCopy(field: any, candidate: any) {
  const fieldName =
    String(field?.name ?? '').trim() || 'Tarlan';
  const currentLevelLabel =
    RISK_LABELS_TR[candidate.level] ?? candidate.level;

  if (candidate.kind === 'forecast') {
    return {
      title: `Pusula Risk Radarı • ${fieldName}`,
      headline: `${candidate.displayName} riski yükseliyor`,
      body:
        `${candidate.displayName}: şu an %${Math.round(candidate.score)}, ` +
        `${candidate.peakDate ?? 'yakın günlerde'} için %${Math.round(candidate.peakScore7d)} seviyesine çıkabilir. ` +
        'Saha kontrolünü planla; belirti görürsen fotoğrafla doğrula.',
    };
  }

  return {
    title: `Pusula Risk Radarı • ${fieldName}`,
    headline:
      `${candidate.displayName} riski ${currentLevelLabel.toLocaleLowerCase('tr-TR')}`,
    body:
      `${candidate.displayName} riski %${Math.round(candidate.score)} (${currentLevelLabel}). ` +
      'Saha kontrolünü önceliklendir; belirti görürsen fotoğrafla doğrula.',
  };
}

async function saveInsight(
  field: any,
  candidate: any,
  copy: ReturnType<typeof notificationCopy>,
) {
  const scoreBucket =
    Math.floor(candidate.notifyScore / 10) * 10;
  const contextHash = [
    'risk-radar',
    field.id,
    candidate.displayName,
    candidate.kind,
    candidate.peakDate ?? candidate.score,
    scoreBucket,
  ].join(':');

  const { error } = await supabaseAdmin
    .from('pusula_insights')
    .insert({
      user_id: field.user_id,
      field_id: field.id,
      screen: 'home',
      headline: copy.headline,
      summary: copy.body,
      reasons: candidate.reasons ?? [],
      related_modules: [
        'risk-radar',
        'weather',
        'field-health',
      ],
      confidence:
        candidate.notifyScore >= 65
          ? 'yuksek'
          : 'orta',
      data_warning:
        'Risk skoru erken uyarıdır; kesin teşhis veya ilaçlama talimatı değildir.',
      context_hash: contextHash,
      model: 'tarlapusula-risk-radar-v1.1',
      source_generated_at: new Date().toISOString(),
    });

  if (error) {
    console.warn(
      '[risk-radar-dispatch] insight kaydı:',
      error.message,
    );
  }
}

async function processField(field: any, state: any) {
  const checkedAt = new Date().toISOString();

  try {
    const risk = await calculateFieldRisk(field);

    if (!risk.supported) {
      await supabaseAdmin
        .from('field_risk_notification_state')
        .upsert(
          {
            user_id: field.user_id,
            field_id: field.id,
            last_checked_at: checkedAt,
            last_error: risk.reason,
            updated_at: checkedAt,
          },
          {
            onConflict: 'user_id,field_id',
          },
        );

      return 'unsupported';
    }

    const top = risk.top;
    if (!top) return 'checked';

    const candidate = notificationCandidate(risk);
    const notify = shouldNotify(state, candidate);
    let sent = 0;
    let noSubscriptions = false;

    if (notify && candidate) {
      const copy = notificationCopy(field, candidate);

      await saveInsight(
        field,
        candidate,
        copy,
      );

      const push = await sendToUser(
        String(field.user_id),
        {
          title: copy.title,
          body: copy.body,
          tag:
            `risk-radar-${field.id}-${candidate.displayName}`,
          url:
            `/?open=risk-radar&fieldId=${encodeURIComponent(String(field.id))}`,
          fieldId: field.id,
          source: 'risk-radar',
          riskScore: candidate.notifyScore,
          riskLevel: candidate.notifyLevel,
          threat: candidate.displayName,
        },
        candidate.notifyLevel === 'critical'
          ? 'high'
          : 'normal',
      );

      sent = push.sent;
      noSubscriptions = push.noSubscriptions;
    }

    await supabaseAdmin
      .from('field_risk_notification_state')
      .upsert(
        {
          user_id: field.user_id,
          field_id: field.id,
          last_threat: top.displayName,
          last_score: top.score,
          last_level: top.level,
          last_peak_score: top.peakScore7d,
          last_peak_date:
            cleanDate(top.peakDate) ?? null,
          last_checked_at: checkedAt,
          ...(notify && candidate
            ? {
                last_notified_at: checkedAt,
                last_notified_threat:
                  candidate.displayName,
                last_notified_score:
                  candidate.notifyScore,
                last_notified_level:
                  candidate.notifyLevel,
              }
            : {}),
          last_error:
            notify && noSubscriptions
              ? 'no_active_subscription'
              : null,
          updated_at: checkedAt,
        },
        {
          onConflict: 'user_id,field_id',
        },
      );

    if (notify) {
      return sent > 0
        ? 'notified'
        : 'insight_only';
    }

    return 'checked';
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 500)
        : 'risk_check_failed';

    console.error(
      '[risk-radar-dispatch] field failed:',
      field.id,
      message,
    );

    await supabaseAdmin
      .from('field_risk_notification_state')
      .upsert(
        {
          user_id: field.user_id,
          field_id: field.id,
          last_checked_at: checkedAt,
          last_error: message,
          updated_at: checkedAt,
        },
        {
          onConflict: 'user_id,field_id',
        },
      );

    return 'failed';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    if (!(await isAuthorizedCronRequest(req))) {
      return json(
        {
          ok: false,
          error: 'Unauthorized cron request.',
        },
        401,
      );
    }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const { data: fields, error: fieldError } =
      await supabaseAdmin
        .from('fields')
        .select(
          'id,user_id,name,crop,season,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng',
        )
        .limit(500);

    if (fieldError) throw fieldError;

    const supportedFields = (fields ?? []).filter(
      (field: any) => Boolean(normalizeCrop(field?.crop)),
    );

    if (!supportedFields.length) {
      return json({
        ok: true,
        checked: 0,
        notified: 0,
        insightOnly: 0,
        skipped: 0,
        failed: 0,
      });
    }

    const fieldIds = supportedFields.map(
      (field: any) => String(field.id),
    );

    const { data: states, error: stateError } =
      await supabaseAdmin
        .from('field_risk_notification_state')
        .select('*')
        .in('field_id', fieldIds);

    if (stateError) throw stateError;

    const stateByField = new Map(
      (states ?? []).map((state: any) => [
        String(state.field_id),
        state,
      ]),
    );

    const now = Date.now();

    const eligible = supportedFields
      .map((field: any) => {
        const state =
          stateByField.get(String(field.id)) ?? null;
        const lastChecked = state?.last_checked_at
          ? new Date(state.last_checked_at).getTime()
          : 0;

        return {
          field,
          state,
          lastChecked,
        };
      })
      .filter((item: any) => {
        if (force) return true;
        if (!item.lastChecked) return true;
        return (
          now - item.lastChecked >= CHECK_INTERVAL_MS
        );
      })
      .sort(
        (a: any, b: any) =>
          (a.lastChecked || 0) -
          (b.lastChecked || 0),
      )
      .slice(0, MAX_FIELDS_PER_RUN);

    const results: string[] = [];
    const concurrency = 3;

    for (
      let index = 0;
      index < eligible.length;
      index += concurrency
    ) {
      const chunk = eligible.slice(
        index,
        index + concurrency,
      );

      results.push(
        ...(await Promise.all(
          chunk.map((item: any) =>
            processField(
              item.field,
              item.state,
            ),
          ),
        )),
      );
    }

    return json({
      ok: true,
      checked: results.length,
      notified: results.filter(
        (item) => item === 'notified',
      ).length,
      insightOnly: results.filter(
        (item) => item === 'insight_only',
      ).length,
      unsupported: results.filter(
        (item) => item === 'unsupported',
      ).length,
      failed: results.filter(
        (item) => item === 'failed',
      ).length,
      skipped: Math.max(
        0,
        supportedFields.length - eligible.length,
      ),
      forced: force,
    });
  } catch (error) {
    console.error(
      '[risk-radar-dispatch]',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Risk Radar bildirimi çalıştırılamadı.',
      },
      500,
    );
  }
});
