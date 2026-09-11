import {
  useMemo,
} from 'react';

import {
  buildFieldPhenology,
} from '../services/buildFieldPhenology';

import type {
  FieldForPhenology,
  NdviTrendForPhenology,
} from '../services/buildFieldPhenology';

import type {
  PhenologyResult,
} from '../types/phenology';

export function useFieldPhenology(
  field:
    | FieldForPhenology
    | null
    | undefined,
  ndviTrend?:
    NdviTrendForPhenology,
): PhenologyResult | null {
  return useMemo(
    () => {
      if (!field) {
        return null;
      }

      return buildFieldPhenology(
        field,
        ndviTrend ??
          null,
      );
    },
    [
      field,
      ndviTrend?.direction,
      ndviTrend?.quality,
      ndviTrend?.latestAverage,
      ndviTrend?.changeFromPrevious,
      ndviTrend?.changeFromFirst,
    ],
  );
}
