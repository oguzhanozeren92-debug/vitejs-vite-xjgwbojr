import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function routeFor(engine: string, operation: string) {
  if (engine === 'pyfao56' && operation === 'shadow-run') {
    return '/v1/irrigation/pyfao56/shadow';
  }
  if (engine === 'pcse' && operation === 'readiness') {
    return '/v1/phenology/pcse/readiness';
  }
  if (engine === 'aquacrop' && operation === 'readiness') {
    return '/v1/scenario/aquacrop/readiness';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const gatewayUrl = (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, '');
    const gatewayKey = Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '';

    if (!gatewayUrl || !gatewayKey) {
      return json({
        ok: false,
        error: 'Model Gateway henüz sunucu tarafında yapılandırılmadı.',
      });
    }

    const body = await req.json();
    const engine = String(body?.engine ?? '').trim();
    const operation = String(body?.operation ?? '').trim();
    const route = routeFor(engine, operation);

    if (!route) {
      return json({ ok: false, error: 'Geçersiz model motoru işlemi.' }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(`${gatewayUrl}${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Model-Gateway-Key': gatewayKey,
        },
        body: JSON.stringify(body?.payload ?? {}),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return json({
          ok: false,
          error:
            payload?.detail ??
            payload?.error ??
            `Model Gateway ${response.status} hatası verdi.`,
        });
      }

      return json(payload ?? { ok: false, error: 'Model Gateway boş yanıt döndürdü.' });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Model Gateway zaman aşımına uğradı.'
        : error instanceof Error
          ? error.message
          : 'Model Gateway isteği başarısız oldu.';

    console.error('[model-engine-shadow]', message);
    return json({ ok: false, error: message });
  }
});
