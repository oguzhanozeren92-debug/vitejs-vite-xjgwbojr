import { supabase } from '../supabaseClient';
import type { PusulaFieldContext } from '../lib/pusulaFieldContext';

export async function savePusulaFieldContextSnapshot(
  context: PusulaFieldContext,
) {
  if (!supabase) return { saved: false as const, reason: 'no_supabase' };

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.user?.id) {
    return { saved: false as const, reason: 'no_session' };
  }

  const userId = sessionData.session.user.id;

  const { error } = await supabase
    .from('pusula_field_context_snapshots')
    .upsert(
      {
        user_id: userId,
        field_id: context.field.id,
        schema_version: context.schemaVersion,
        context,
        source_health: context.sourceHealth,
        generated_at: context.generatedAt,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,field_id',
      },
    );

  if (error) {
    console.info(
      'Pusula field context snapshot kaydedilemedi:',
      error.message,
    );

    return {
      saved: false as const,
      reason: error.message,
    };
  }

  return { saved: true as const };
}

export async function loadLatestPusulaFieldContext(
  fieldId: string,
): Promise<PusulaFieldContext | null> {
  if (!supabase || !fieldId) return null;

  const { data, error } = await supabase
    .from('pusula_field_context_snapshots')
    .select('context')
    .eq('field_id', String(fieldId))
    .maybeSingle();

  if (error || !data?.context) return null;

  return data.context as PusulaFieldContext;
}
