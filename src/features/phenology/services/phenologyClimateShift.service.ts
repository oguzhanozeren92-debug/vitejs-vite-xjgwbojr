import {
  supabase,
} from '../../../supabaseClient';

import type {
  PhenologyClimateShiftResult,
} from '../types/phenologyClimateShift';

type Coordinate = {
  latitude: number;
  longitude: number;
};

function finiteNumber(
  value: unknown,
): number | null {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function walkCoordinates(
  value: any,
  sink:
    Array<
      [
        number,
        number,
      ]
    >,
) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2 &&
    Number.isFinite(
      Number(value[0]),
    ) &&
    Number.isFinite(
      Number(value[1]),
    )
  ) {
    const longitude =
      Number(value[0]);

    const latitude =
      Number(value[1]);

    if (
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    ) {
      sink.push([
        longitude,
        latitude,
      ]);
    }

    return;
  }

  for (
    const child
    of value
  ) {
    walkCoordinates(
      child,
      sink,
    );
  }
}

function geometryCenter(
  parcelGeometry: any,
): Coordinate | null {
  const geometry =
    parcelGeometry
      ?.geometry ??
    parcelGeometry;

  const coordinates =
    geometry?.coordinates;

  if (!coordinates) {
    return null;
  }

  const points:
    Array<
      [
        number,
        number,
      ]
    > = [];

  walkCoordinates(
    coordinates,
    points,
  );

  if (!points.length) {
    return null;
  }

  let west =
    Infinity;
  let east =
    -Infinity;
  let south =
    Infinity;
  let north =
    -Infinity;

  for (
    const [
      longitude,
      latitude,
    ]
    of points
  ) {
    west =
      Math.min(
        west,
        longitude,
      );

    east =
      Math.max(
        east,
        longitude,
      );

    south =
      Math.min(
        south,
        latitude,
      );

    north =
      Math.max(
        north,
        latitude,
      );
  }

  return {
    longitude:
      (west + east) /
      2,

    latitude:
      (south + north) /
      2,
  };
}

function fieldCenter(
  field: any,
): Coordinate {
  const latitude =
    finiteNumber(
      field?.parcelCentroidLat ??
      field?.parcel_centroid_lat ??
      field?.latitude,
    );

  const longitude =
    finiteNumber(
      field?.parcelCentroidLng ??
      field?.parcel_centroid_lng ??
      field?.longitude,
    );

  if (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return {
      latitude,
      longitude,
    };
  }

  const fromGeometry =
    geometryCenter(
      field?.parcelGeometry ??
      field?.parcel_geometry,
    );

  if (fromGeometry) {
    return fromGeometry;
  }

  throw new Error(
    'Fenoloji iklim düzeltmesi için tarla konumu bulunamadı.',
  );
}

function normalizeResult(
  data: any,
): PhenologyClimateShiftResult {
  const status =
    data?.status ===
      'ready' ||
    data?.status ===
      'not_applicable' ||
    data?.status ===
      'insufficient_data'
      ? data.status
      : 'insufficient_data';

  const rawShift =
    finiteNumber(
      data?.shiftDays,
    );

  const shiftDays =
    Math.max(
      -14,
      Math.min(
        14,
        rawShift === null
          ? 0
          : Math.round(
              rawShift,
            ),
      ),
    );

  return {
    success:
      Boolean(
        data?.success,
      ),

    status,

    shiftDays,

    seasonAdvanceDays:
      finiteNumber(
        data?.seasonAdvanceDays,
      ),

    confidence:
      data?.confidence ===
        'medium'
        ? 'medium'
        : 'low',

    anomalyC:
      finiteNumber(
        data?.anomalyC,
      ),

    currentThermalUnits:
      finiteNumber(
        data?.currentThermalUnits,
      ),

    baselineThermalUnits:
      finiteNumber(
        data?.baselineThermalUnits,
      ),

    baselineYearsUsed:
      Math.max(
        0,
        Math.round(
          finiteNumber(
            data?.baselineYearsUsed,
          ) ??
          0,
        ),
      ),

    currentCoverage:
      finiteNumber(
        data?.currentCoverage,
      ),

    source:
      String(
        data?.source ??
        'ERA5-Land',
      ),

    method:
      data?.method
        ? String(
            data.method,
          )
        : null,

    period:
      data?.period
        ? {
            from:
              String(
                data.period.from ??
                '',
              ),
            to:
              String(
                data.period.to ??
                '',
              ),
          }
        : null,

    caution:
      data?.caution
        ? String(
            data.caution,
          )
        : null,

    message:
      data?.reason
        ? String(
            data.reason,
          )
        : data?.message
          ? String(
              data.message,
            )
          : null,
  };
}

export async function fetchPhenologyClimateShift(
  field: any,
  options?: {
    currentDate?:
      | string
      | Date
      | null;
  },
): Promise<PhenologyClimateShiftResult> {
  const {
    latitude,
    longitude,
  } =
    fieldCenter(
      field,
    );

  const cropName =
    String(
      field?.cropName ??
      field?.crop ??
      '',
    ).trim();

  const currentDate =
    options?.currentDate instanceof
    Date
      ? options.currentDate
          .toISOString()
      : options?.currentDate
        ? String(
            options.currentDate,
          )
        : undefined;

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'phenology-climate-shift',
      {
        body: {
          latitude,
          longitude,

          /*
            Edge Function cropKey'i şimdilik yalnızca izlenebilirlik için
            taşıyor. Fenoloji evresini sıcaklık servisi üretmez.
          */
          cropKey:
            cropName ||
            null,

          currentDate,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(
      data?.message ??
      'Fenoloji iklim düzeltmesi alınamadı.',
    );
  }

  return normalizeResult(
    data,
  );
}
