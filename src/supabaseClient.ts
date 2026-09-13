import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import {
  createEdgeFunctionDataBridge,
  warmEdgeFunctionDataBridge,
} from './features/data-bridge/edgeFunctionDataBridge';

const env = import.meta.env;

/*
  Önce Vite .env değerlerini kullanır.
  .env yoksa TarlaPusula'nın kendi publishable
  Supabase bilgilerine fallback yapar.
*/

const DEFAULT_SUPABASE_URL =
  'https://xwyfidtktauxivsosmex.supabase.co';

const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_Ans_S4Zx2A1LXLT7FMfEZA_h-n-kfu_';

const rawSupabaseUrl = String(
  env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_PROJECT_URL ||
    DEFAULT_SUPABASE_URL,
).trim();

const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const supabaseKey = String(
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY,
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey,
);

export const supabaseConfigError = !supabaseUrl
  ? 'Supabase URL bulunamadı.'
  : !supabaseKey
    ? 'Supabase publishable key bulunamadı.'
    : '';

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'tarlapusula-auth',
        },
      },
    );

    /*
     * TEK VERİ KÖPRÜSÜ
     * -------------------------------------------------------
     * Harita/uydu/toprak/iklim gibi salt-okuma Edge Function çağrıları artık
     * hangi ekran çağırırsa çağırsın aynı persistent snapshot deposundan geçer.
     *
     * Böylece Home, UnifiedMap ve diğer ekranlar aynı veri için paralel istek
     * açmaz. Son başarılı snapshot ekranda kalır; kaynak gerçekten yenilenirse
     * arka plandaki refresh cache'i atomik olarak değiştirir.
     */
    const functionsClient = client.functions as any;
    const originalInvoke = functionsClient.invoke.bind(functionsClient);

    functionsClient.invoke = createEdgeFunctionDataBridge({
      originalInvoke,
      getScope: async () => {
        try {
          const { data } = await client!.auth.getSession();
          return data.session?.user?.id ?? 'anon';
        } catch {
          return 'anon';
        }
      },
    });

    // IndexedDB snapshot'larını React ekranları açılmadan mümkün olduğunca erken
    // belleğe al. Bu, uygulama tekrar açıldığında ilk katman geçişini hızlandırır.
    void warmEdgeFunctionDataBridge();

    console.log(
      'TarlaPusula Supabase bağlantısı hazır:',
      supabaseUrl,
    );
  } catch (error) {
    console.error(
      'Supabase istemcisi oluşturulamadı:',
      error,
    );
  }
} else {
  console.error(
    'TarlaPusula Supabase ayarları eksik:',
    supabaseConfigError,
  );
}

export const supabase: SupabaseClient | null = client;
