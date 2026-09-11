import { supabase } from '../../../supabaseClient';

export async function fetchHomeSatelliteDate(parcelGeometry: unknown) {
  const { data, error } = await supabase.functions.invoke(
    'sentinel2-latest-date',
    {
      body: {
        geometry: parcelGeometry,
        daysBack: 45,
        maxCloudCoverage: 30,
      },
    },
  );

  if (error) throw error;
  return String(data?.latestImageDate ?? '').trim();
}
