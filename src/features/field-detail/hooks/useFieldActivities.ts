import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { supabase } from '../../../supabaseClient';
import { addPoints } from '../../../gamification/useGamificationStore';
import { blobToBase64 } from '../../../utils/fileUtils';
import { normalizeAiAccessStatus } from '../../../utils/aiAccessUtils';
import type {
  AiAccessStatus,
  AiFieldAnalysis,
  Field,
  FieldActivity,
  Screen,
} from '../../../types';
import type { UnifiedClimateContext } from '../../weather/hooks/useAppWeatherData';

type UseFieldActivitiesOptions = {
  selectedField: Field | null;
  setSelectedField: Dispatch<SetStateAction<Field | null>>;
  realFields: Field[];
  setScreen: Dispatch<SetStateAction<Screen>>;
  unifiedClimateContext: UnifiedClimateContext | null;
};

export function useFieldActivities({
  selectedField,
  setSelectedField,
  realFields,
  setScreen,
  unifiedClimateContext,
}: UseFieldActivitiesOptions) {
  const [activities, setActivities] = useState<FieldActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [activityFormLoading, setActivityFormLoading] = useState(false);
  const [activityMessage, setActivityMessage] = useState('');
  const [activityType, setActivityType] = useState('Saha Kontrolü');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityProductName, setActivityProductName] = useState('');
  const [activityQuantity, setActivityQuantity] = useState('');
  const [activityUnit, setActivityUnit] = useState('');
  const [activityDoseMode, setActivityDoseMode] = useState<'per_decare' | 'total'>('per_decare');
  const [activityWaterM3, setActivityWaterM3] = useState('');
  const [activityDurationHours, setActivityDurationHours] = useState('');
  const [activityCost, setActivityCost] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [activityPhoto, setActivityPhoto] = useState<File | null>(null);
  const [activityPhotoPreview, setActivityPhotoPreview] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<AiFieldAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [aiAccessStatus, setAiAccessStatus] = useState<AiAccessStatus | null>(null);
  const [aiAccessLoading, setAiAccessLoading] = useState(false);

  const clearActivityPhoto = () => {
    if (activityPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(activityPhotoPreview);
    }
    setActivityPhoto(null);
    setActivityPhotoPreview('');
    setAiAnalysis(null);
    setAiAnalysisError('');
  };

  const handleActivityPhotoChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setActivityMessage('Lütfen bir fotoğraf dosyası seç.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setActivityMessage('Fotoğraf 12 MB’dan küçük olmalı.');
      return;
    }

    clearActivityPhoto();
    setActivityPhoto(file);
    setActivityPhotoPreview(URL.createObjectURL(file));
    setAiAnalysis(null);
    setAiAnalysisError('');
    setActivityMessage('');
  };

  const compressActivityPhoto = async (file: File): Promise<Blob> => {
    const image = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      throw new Error('Fotoğraf hazırlanamadı.');
    }
    context.drawImage(image, 0, 0, width, height);
    image.close();

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Fotoğraf sıkıştırılamadı.'))),
        'image/jpeg',
        0.82,
      );
    });
  };

  const loadAiAccessStatus = async () => {
    setAiAccessLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_ai_access_status');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setAiAccessStatus(normalizeAiAccessStatus(row));
    } catch (error) {
      console.error('AI kullanım hakkı yüklenemedi:', error);
    } finally {
      setAiAccessLoading(false);
    }
  };

  const openAiAnalysisScreen = () => {
    setActivityType('Saha Kontrolü');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityNotes('');
    setActivityMessage('');
    clearActivityPhoto();
    setAiAnalysis(null);
    setAiAnalysisError('');

    if (!selectedField && realFields.length > 0) setSelectedField(realFields[0]);
    setScreen('aiAnalysis');
    void loadAiAccessStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAiAnalyzeActivityPhoto = async () => {
    if (!selectedField || !activityPhoto) {
      setAiAnalysisError('Önce analiz edilecek bir fotoğraf seç.');
      return;
    }

    setAiAnalyzing(true);
    setAiAnalysisError('');
    setAiAnalysis(null);

    try {
      const compressedPhoto = await compressActivityPhoto(activityPhoto);
      let photoRewardHash = `${activityPhoto.name}:${activityPhoto.size}:${activityPhoto.lastModified}`;

      try {
        if (globalThis.crypto?.subtle) {
          const digest = await globalThis.crypto.subtle.digest(
            'SHA-256',
            await compressedPhoto.arrayBuffer(),
          );
          photoRewardHash = Array.from(new Uint8Array(digest))
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('');
        }
      } catch (hashError) {
        console.warn('AI analiz fotoğraf hash değeri üretilemedi:', hashError);
      }

      const imageBase64 = await blobToBase64(compressedPhoto);
      const { data, error } = await supabase.functions.invoke('analyze-field-image', {
        body: {
          imageBase64,
          mimeType: 'image/jpeg',
          crop: selectedField.crop,
          fieldName: selectedField.name,
          notes: activityNotes.trim() || null,
          climateContext:
            unifiedClimateContext &&
            String(unifiedClimateContext.fieldId) === String(selectedField.id)
              ? unifiedClimateContext
              : null,
        },
      });
      if (error) throw error;

      if (data?.access) setAiAccessStatus(normalizeAiAccessStatus(data.access));
      if (data?.limitReached) {
        throw new Error(data?.message ?? 'Bugünkü ücretsiz AI analiz hakkını kullandın.');
      }
      if (!data?.analysis) throw new Error('AI analiz sonucu alınamadı.');

      const result = data.analysis as AiFieldAnalysis;
      let rewardSuffix = '';
      try {
        const reward = await addPoints('PEST_ANALYSIS', {
          dedupeKey: `pest-analysis:${String(selectedField.id)}:${photoRewardHash}`,
          metadata: {
            source: 'ai_analysis',
            fieldId: String(selectedField.id),
            crop: selectedField.crop ?? null,
            photoHash: photoRewardHash,
          },
          toastTitle: 'AI fotoğraf analizi ödülü',
        });
        if (reward.awarded && reward.awardedPoints > 0) {
          rewardSuffix = ` · +${reward.awardedPoints} Puan`;
        }
      } catch (pointError) {
        console.warn('AI analiz puanı verilemedi; analiz sonucu korunuyor:', pointError);
      }

      setAiAnalysis({
        status: result.status ?? 'uncertain',
        headline: `${result.headline ?? 'Analiz tamamlandı'}${rewardSuffix}`,
        possibleIssue: result.possibleIssue ?? 'Belirsiz',
        confidence: Math.max(0, Math.min(100, Number(result.confidence ?? 0))),
        observations: Array.isArray(result.observations) ? result.observations : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        disclaimer: result.disclaimer ?? 'Bu sonuç yalnızca fotoğrafa dayalı ön değerlendirmedir.',
      });
      void loadAiAccessStatus();
    } catch (error) {
      console.error('AI saha analizi hatası:', error);
      setAiAnalysisError(error instanceof Error ? error.message : 'Fotoğraf AI ile analiz edilemedi.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const resetActivityForm = (type = 'Saha Kontrolü') => {
    setActivityType(type);
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityProductName('');
    setActivityQuantity('');
    setActivityUnit('');
    setActivityDoseMode(type === 'Gübreleme' || type === 'İlaçlama' ? 'per_decare' : 'total');
    setActivityWaterM3('');
    setActivityDurationHours('');
    setActivityCost('');
    setActivityNotes('');
    clearActivityPhoto();
    setAiAnalysis(null);
    setAiAnalysisError('');
    setActivityMessage('');
  };

  const loadFieldActivities = async (field: Field) => {
    if (field.demo) {
      setActivities([]);
      return;
    }

    setActivitiesLoading(true);
    setActivityMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setActivities([]);
        return;
      }

      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, title, activity_date, product_name, quantity, unit, cost, notes, photo_path, ai_analysis')
        .eq('field_id', String(field.id))
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mappedActivities = await Promise.all(
        (data ?? []).map(async (item) => {
          let photoUrl: string | null = null;
          if (item.photo_path) {
            const { data: signedData } = await supabase.storage
              .from('field-activity-photos')
              .createSignedUrl(item.photo_path, 60 * 60);
            photoUrl = signedData?.signedUrl ?? null;
          }

          return {
            id: String(item.id),
            type: item.activity_type ?? 'Diğer',
            title: item.title ?? item.activity_type ?? 'Tarla işlemi',
            activityDate: item.activity_date,
            productName: item.product_name ?? null,
            quantity: item.quantity == null ? null : Number(item.quantity),
            unit: item.unit ?? null,
            cost: item.cost == null ? null : Number(item.cost),
            notes: item.notes ?? null,
            photoPath: item.photo_path ?? null,
            photoUrl,
            aiAnalysis: item.ai_analysis ? (item.ai_analysis as AiFieldAnalysis) : null,
          } satisfies FieldActivity;
        }),
      );
      setActivities(mappedActivities);
    } catch (error) {
      console.error('Tarla işlemleri yüklenemedi:', error);
      setActivityMessage(error instanceof Error ? error.message : 'Tarla işlemleri yüklenemedi.');
    } finally {
      setActivitiesLoading(false);
    }
  };

  const openActivityForm = (type: string) => {
    if (!selectedField || selectedField.demo) {
      alert('Örnek tarlaya gerçek işlem kaydı eklenmez.');
      return;
    }
    resetActivityForm(type);
    setActivityFormOpen(true);
    setTimeout(() => {
      document.querySelector('.tp-activity-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleAddActivity = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedField || selectedField.demo) return;

    const quantityValue = activityQuantity.trim() ? Number(activityQuantity.replace(',', '.')) : null;
    const costValue = activityCost.trim() ? Number(activityCost.replace(',', '.')) : null;
    const waterM3Value = activityWaterM3.trim() ? Number(activityWaterM3.replace(',', '.')) : null;
    const durationHoursValue = activityDurationHours.trim()
      ? Number(activityDurationHours.replace(',', '.'))
      : null;
    const isDoseActivity = activityType === 'Gübreleme' || activityType === 'İlaçlama';

    const calculatedTotalQuantity =
      isDoseActivity && quantityValue !== null && activityDoseMode === 'per_decare' && selectedField.area > 0
        ? quantityValue * selectedField.area
        : quantityValue;
    const calculatedPerDecare =
      isDoseActivity && quantityValue !== null && activityDoseMode === 'total' && selectedField.area > 0
        ? quantityValue / selectedField.area
        : quantityValue;

    if (quantityValue !== null && (!Number.isFinite(quantityValue) || quantityValue < 0)) {
      setActivityMessage('Miktar geçerli bir sayı olmalı.');
      return;
    }
    if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) {
      setActivityMessage('Maliyet geçerli bir sayı olmalı.');
      return;
    }
    if (waterM3Value !== null && (!Number.isFinite(waterM3Value) || waterM3Value < 0)) {
      setActivityMessage('Sulama suyu miktarı geçerli bir sayı olmalı.');
      return;
    }
    if (durationHoursValue !== null && (!Number.isFinite(durationHoursValue) || durationHoursValue < 0)) {
      setActivityMessage('Sulama süresi geçerli bir sayı olmalı.');
      return;
    }

    setActivityFormLoading(true);
    setActivityMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      let uploadedPhotoPath: string | null = null;
      if (activityPhoto) {
        setActivityMessage('Fotoğraf hazırlanıyor...');
        const compressedPhoto = await compressActivityPhoto(activityPhoto);
        uploadedPhotoPath = `${user.id}/${selectedField.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('field-activity-photos')
          .upload(uploadedPhotoPath, compressedPhoto, {
            contentType: 'image/jpeg',
            upsert: false,
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;
        setActivityMessage('');
      }

      const automaticDetails: string[] = [];
      if (isDoseActivity && quantityValue !== null) {
        if (activityDoseMode === 'per_decare') {
          automaticDetails.push(`Dekara uygulama: ${quantityValue} ${activityUnit || ''}/da`);
          automaticDetails.push(`Toplam kullanılan: ${calculatedTotalQuantity} ${activityUnit || ''}`);
        } else {
          automaticDetails.push(`Toplam kullanılan: ${quantityValue} ${activityUnit || ''}`);
          automaticDetails.push(
            `Dekara uygulama: ${calculatedPerDecare !== null ? calculatedPerDecare.toFixed(2) : '0.00'} ${activityUnit || ''}/da`,
          );
        }
      }
      if (activityType === 'Sulama') {
        if (waterM3Value !== null) {
          automaticDetails.push(`Toplam sulama suyu: ${waterM3Value} m³`);
          if (selectedField.area > 0) {
            automaticDetails.push(`Dekara sulama suyu: ${(waterM3Value / selectedField.area).toFixed(2)} m³/da`);
          }
        }
        if (durationHoursValue !== null) automaticDetails.push(`Sulama süresi: ${durationHoursValue} saat`);
      }

      const combinedNotes = [...automaticDetails, activityNotes.trim()].filter(Boolean).join(' • ');
      const { error } = await supabase.from('activities').insert({
        user_id: user.id,
        field_id: String(selectedField.id),
        field_section_id: null,
        activity_type: activityType,
        title: activityType,
        activity_date: activityDate,
        product_name: activityProductName.trim() || null,
        quantity: isDoseActivity ? calculatedTotalQuantity : quantityValue,
        unit: activityType === 'Sulama' && waterM3Value !== null ? 'm³' : activityUnit.trim() || null,
        cost: costValue,
        notes: combinedNotes || null,
        photo_path: uploadedPhotoPath,
        ai_analysis: aiAnalysis,
        ai_analyzed_at: aiAnalysis ? new Date().toISOString() : null,
      });

      if (error) {
        if (uploadedPhotoPath) {
          await supabase.storage.from('field-activity-photos').remove([uploadedPhotoPath]);
        }
        throw error;
      }

      resetActivityForm();
      setActivityFormOpen(false);
      await loadFieldActivities(selectedField);
    } catch (error) {
      console.error('Tarla işlemi kaydedilemedi:', error);
      setActivityMessage(error instanceof Error ? error.message : 'Tarla işlemi kaydedilemedi.');
    } finally {
      setActivityFormLoading(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!selectedField || selectedField.demo) return;
    if (!window.confirm('Bu işlem kaydını silmek istiyor musun?')) return;

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const activityToDelete = activities.find((item) => item.id === id);
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;

      if (activityToDelete?.photoPath) {
        await supabase.storage.from('field-activity-photos').remove([activityToDelete.photoPath]);
      }
      await loadFieldActivities(selectedField);
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : 'İşlem kaydı silinemedi.');
    }
  };

  return {
    activities,
    activitiesLoading,
    activityFormOpen,
    setActivityFormOpen,
    activityFormLoading,
    activityMessage,
    setActivityMessage,
    activityType,
    setActivityType,
    activityDate,
    setActivityDate,
    activityProductName,
    setActivityProductName,
    activityQuantity,
    setActivityQuantity,
    activityUnit,
    setActivityUnit,
    activityDoseMode,
    setActivityDoseMode,
    activityWaterM3,
    setActivityWaterM3,
    activityDurationHours,
    setActivityDurationHours,
    activityCost,
    setActivityCost,
    activityNotes,
    setActivityNotes,
    activityPhoto,
    activityPhotoPreview,
    aiAnalysis,
    aiAnalyzing,
    aiAnalysisError,
    aiAccessStatus,
    aiAccessLoading,
    clearActivityPhoto,
    handleActivityPhotoChange,
    loadAiAccessStatus,
    openAiAnalysisScreen,
    handleAiAnalyzeActivityPhoto,
    resetActivityForm,
    loadFieldActivities,
    openActivityForm,
    handleAddActivity,
    handleDeleteActivity,
  };
}
