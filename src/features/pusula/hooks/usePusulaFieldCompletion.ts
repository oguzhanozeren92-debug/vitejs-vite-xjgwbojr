import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  loadFieldCompletionContext,
  saveFieldCanopyDevelopmentClass,
  saveFieldCanopyHeightClass,
  saveFieldIrrigationStatus,
  type FieldCompletionContext,
  type FieldIrrigationStatusValue,
} from '../../fields/services/fieldCompletion.service';

import {
  CANOPY_DEVELOPMENT_OPTIONS,
  CANOPY_HEIGHT_OPTIONS,
  estimateCanopyDevelopmentFromAge,
  isTreeOrchardCanopyCrop,
} from '../../fields/data/canopyDevelopmentProfiles';

export type PusulaFieldQuestionOption = {
  value: string;
  label: string;
  hint?: string;
  recommended?: boolean;
};

export type PusulaFieldAnswer =
  | FieldIrrigationStatusValue
  | string
  | number;

export type PusulaFieldQuestion =
  | {
      id: string;
      kind: 'choice';
      prompt: string;
      helper?: string;
      options: PusulaFieldQuestionOption[];
    }
  | {
      id: string;
      kind: 'number';
      prompt: string;
      helper?: string;
      unit: string;
      min: number;
      max: number;
      step: number;
      placeholder?: string;
    };

type UsePusulaFieldCompletionInput = {
  field: any | null | undefined;
  fields?: any[] | null;
};

type ContextState = {
  fieldId: string;
  checked: boolean;
  loading: boolean;
  data: FieldCompletionContext | null;
  error: string | null;
};

const EMPTY_CONTEXT_STATE: ContextState = {
  fieldId: '',
  checked: false,
  loading: false,
  data: null,
  error: null,
};

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function usePusulaFieldCompletion({
  field,
  fields,
}: UsePusulaFieldCompletionInput) {
  const fieldId = textOrNull(field?.id) ?? '';
  const [reloadKey, setReloadKey] = useState(0);
  const [contextState, setContextState] =
    useState<ContextState>(EMPTY_CONTEXT_STATE);

  const rawField = useMemo(() => {
    if (!fieldId || !Array.isArray(fields)) return null;

    return (
      fields.find(
        (item) => String(item?.id ?? '') === fieldId,
      ) ?? null
    );
  }, [fieldId, fields]);

  useEffect(() => {
    let cancelled = false;

    if (!fieldId || field?.demo) {
      setContextState({
        fieldId,
        checked: true,
        loading: false,
        data: null,
        error: null,
      });

      return () => {
        cancelled = true;
      };
    }

    setContextState({
      fieldId,
      checked: false,
      loading: true,
      data: null,
      error: null,
    });

    void loadFieldCompletionContext(fieldId)
      .then((data) => {
        if (cancelled) return;

        setContextState({
          fieldId,
          checked: true,
          loading: false,
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setContextState({
          fieldId,
          checked: true,
          loading: false,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Tarla bilgileri kontrol edilemedi.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldId, field?.demo, reloadKey]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !fieldId
    ) {
      return;
    }

    const handleFieldContextUpdated = (event: Event) => {
      const detail =
        (event as CustomEvent)?.detail ?? {};

      if (
        String(detail?.fieldId ?? '') !== fieldId
      ) {
        return;
      }

      const changedFields =
        Array.isArray(detail?.changedFields)
          ? detail.changedFields.map(
              (item: unknown) => String(item),
            )
          : [];

      if (
        changedFields.some((name: string) =>
          [
            'irrigation_status',
            'canopy_development_class',
            'canopy_height_class',
            'canopy_cover_percent',
            'canopy_height_m',
            'bearing',
            'crop_cycle',
            'planting_year',
            'crop',
          ].includes(name),
        )
      ) {
        setReloadKey((value) => value + 1);
      }
    };

    window.addEventListener(
      'tp:field-context-updated',
      handleFieldContextUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-context-updated',
        handleFieldContextUpdated as EventListener,
      );
    };
  }, [fieldId]);

  const context =
    contextState.fieldId === fieldId
      ? contextState.data
      : null;

  const fieldName =
    textOrNull(field?.name) ??
    textOrNull(rawField?.name) ??
    'Bu tarla';

  const ageSuggestion = useMemo(
    () =>
      context
        ? estimateCanopyDevelopmentFromAge({
            cropName: context.cropName,
            plantingYear: context.plantingYear,
          })
        : null,
    [
      context?.cropName,
      context?.plantingYear,
    ],
  );

  const question =
    useMemo<PusulaFieldQuestion | null>(() => {
      if (
        !fieldId ||
        field?.demo ||
        contextState.fieldId !== fieldId ||
        !contextState.checked ||
        contextState.loading ||
        !context
      ) {
        return null;
      }

      if (!context.irrigationStatus) {
        return {
          id: `field:${fieldId}:irrigation-status`,
          kind: 'choice',
          prompt:
            `${fieldName} nasıl sulanıyor?`,
          helper:
            'Bunu bilirsem su stresi ve sulama yorumlarını doğru yapabilirim.',
          options: [
            {
              value: 'sulu',
              label: 'Sulu',
            },
            {
              value: 'susuz',
              label: 'Susuz',
            },
            {
              value: 'kısmi',
              label: 'Kısmi / İhtiyaca göre',
            },
          ],
        };
      }

      /*
       * Taç gelişimi yalnız ağaç bahçelerinde ve ürün vermeyen/genç kayıtta
       * istenir. Yıllık ürünlere bu soru sorulmaz.
       *
       * Kullanıcının daha önce verdiği sayısal taç/yükseklik değeri varsa
       * tekrar soru sormayız.
       */
      const needsYoungOrchardCanopy =
        context.bearing === false &&
        isTreeOrchardCanopyCrop(
          context.cropName,
        );

      if (!needsYoungOrchardCanopy) {
        return null;
      }

      if (
        context.canopyDevelopmentClass === null &&
        context.canopyCoverPercent === null
      ) {
        const ageLead =
          ageSuggestion
            ? `${fieldName} ${ageSuggestion.plantingYear}'de dikilmiş; yaklaşık ${ageSuggestion.age} yaşında. Yaşına ve ürününe bakınca “${ageSuggestion.suggestedLabel}” bana başlangıç için en yakın seçenek gibi geliyor.`
            : `${fieldName} genç / ürün vermeyen bahçe olarak kayıtlı.`;

        return {
          id: `field:${fieldId}:canopy-development`,
          kind: 'choice',
          prompt:
            `${ageLead} Ağaçların taç gelişimi gerçekte hangisine daha yakın?`,
          helper:
            'Ağacın dallı-yapraklı üst kısmını düşün. Bakım, sulama, budama, toprak ve dikim aralığı yaş tahmininden daha önemli olabilir; senin seçimin esas alınacak.',
          options:
            CANOPY_DEVELOPMENT_OPTIONS.map(
              (option) => ({
                value: option.value,
                label: option.label,
                recommended:
                  ageSuggestion?.suggestedDevelopment ===
                  option.value,
                hint:
                  ageSuggestion?.suggestedDevelopment ===
                  option.value
                    ? 'Dikim yılına göre Pusula tahmini'
                    : undefined,
              }),
            ),
        };
      }

      if (
        context.canopyHeightClass === null &&
        context.canopyHeightM === null
      ) {
        return {
          id: `field:${fieldId}:canopy-height-class`,
          kind: 'choice',
          prompt:
            `${fieldName} için ağaçların ortalama boyu hangisine daha yakın?`,
          helper:
            'Kesin ölçüm gerekmiyor. Bahçenin genelindeki ortalama ağacı düşün.',
          options:
            CANOPY_HEIGHT_OPTIONS.map(
              (option) => ({
                value: option.value,
                label: option.label,
              }),
            ),
        };
      }

      return null;
    }, [
      fieldId,
      field?.demo,
      fieldName,
      context,
      contextState.fieldId,
      contextState.checked,
      contextState.loading,
      ageSuggestion,
    ]);

  const answerQuestion =
    useCallback(
      async (value: PusulaFieldAnswer) => {
        if (!fieldId || !question) {
          throw new Error(
            'Tarla sorusu artık geçerli değil.',
          );
        }

        if (
          question.id.endsWith(
            ':irrigation-status',
          )
        ) {
          if (
            value !== 'sulu' &&
            value !== 'susuz' &&
            value !== 'kısmi'
          ) {
            throw new Error(
              'Geçerli bir sulama durumu seç.',
            );
          }

          await saveFieldIrrigationStatus({
            fieldId,
            irrigationStatus: value,
          });
          return;
        }

        if (
          question.id.endsWith(
            ':canopy-development',
          )
        ) {
          if (typeof value !== 'string') {
            throw new Error(
              'Geçerli bir taç gelişimi seç.',
            );
          }

          await saveFieldCanopyDevelopmentClass({
            fieldId,
            canopyDevelopmentClass:
              value as
                | 'very_small'
                | 'small'
                | 'medium'
                | 'large'
                | 'very_large',
          });
          return;
        }

        if (
          question.id.endsWith(
            ':canopy-height-class',
          )
        ) {
          if (typeof value !== 'string') {
            throw new Error(
              'Geçerli bir ağaç boyu seç.',
            );
          }

          await saveFieldCanopyHeightClass({
            fieldId,
            canopyHeightClass:
              value as
                | 'under_1m'
                | '1_2m'
                | '2_3m'
                | '3_5m'
                | 'over_5m',
          });
          return;
        }

        throw new Error(
          'Bu soru tipi henüz desteklenmiyor.',
        );
      },
      [fieldId, question],
    );

  return {
    question,
    answerQuestion,
    irrigationStatus:
      context?.irrigationStatus ?? null,
    fieldCompletionContext:
      context,
    ageSuggestion,
    checking:
      contextState.fieldId === fieldId &&
      contextState.loading,
    checkError:
      contextState.fieldId === fieldId
        ? contextState.error
        : null,
  };
}
