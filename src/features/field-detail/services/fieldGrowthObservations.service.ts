import { supabase } from '../../../supabaseClient';

export type GrowthObservation = {
  id: string;
  seasonId: string;
  observedOn: string;
  stage: string;
  notes: string | null;
};

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Gözlem kaydetmek için giriş yapmalısın.');
  return user.id;
}

export async function listGrowthObservations(fieldId: string): Promise<GrowthObservation[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('field_growth_observations')
    .select('id, season_id, observed_on, stage, notes')
    .eq('user_id', userId).eq('field_id', fieldId)
    .order('observed_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id), seasonId: String(row.season_id),
    observedOn: String(row.observed_on), stage: String(row.stage), notes: row.notes ?? null,
  }));
}

export async function addGrowthObservation(input: {
  fieldId: string; seasonId: string; observedOn: string; stage: string; notes: string;
}) {
  const userId = await currentUserId();
  const { error } = await supabase.from('field_growth_observations').insert({
    user_id: userId, field_id: input.fieldId, season_id: input.seasonId,
    observed_on: input.observedOn, stage: input.stage.trim(), notes: input.notes.trim() || null,
  });
  if (error) throw error;
}

export async function deleteGrowthObservation(id: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('field_growth_observations')
    .delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
