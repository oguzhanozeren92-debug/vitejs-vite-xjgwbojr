export type FieldOperationType =
  | 'Sürme'
  | 'İkileme'
  | 'Ekim / Dikim'
  | 'Gübreleme'
  | 'İlaçlama'
  | 'Sulama'
  | 'Çapalama'
  | 'Budama'
  | 'Hasat'
  | 'Saha Kontrolü'
  | 'Diğer';

export type FieldOperationCreateInput = {
  fieldId: string;
  type: FieldOperationType;
  date: string;
  productName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  cost?: number | null;
  notes?: string | null;
  photoPath?: string | null;
  aiAnalysis?: unknown | null;
  aiAnalyzedAt?: string | null;
};

export type FieldOperation = {
  id: string;
  userId: string;
  fieldId: string;
  type: FieldOperationType | string;
  title: string;
  date: string;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  notes: string | null;
  photoPath?: string | null;
  aiAnalysis?: unknown | null;
  aiAnalyzedAt?: string | null;
  createdAt: string;
};

export const FIELD_OPERATION_OPTIONS: Array<{
  type: FieldOperationType;
  icon: string;
  shortLabel: string;
}> = [
  { type: 'Sürme', icon: '🚜', shortLabel: 'Sürme' },
  { type: 'İkileme', icon: '↔', shortLabel: 'İkileme' },
  { type: 'Ekim / Dikim', icon: '🌱', shortLabel: 'Ekim' },
  { type: 'Gübreleme', icon: '🧪', shortLabel: 'Gübre' },
  { type: 'İlaçlama', icon: '🧴', shortLabel: 'İlaç' },
  { type: 'Sulama', icon: '💧', shortLabel: 'Sulama' },
  { type: 'Çapalama', icon: '⛏️', shortLabel: 'Çapa' },
  { type: 'Budama', icon: '✂️', shortLabel: 'Budama' },
  { type: 'Hasat', icon: '🧺', shortLabel: 'Hasat' },
  { type: 'Saha Kontrolü', icon: '👁️', shortLabel: 'Kontrol' },
  { type: 'Diğer', icon: '＋', shortLabel: 'Diğer' },
];

const FIELD_OPERATION_TYPES = new Set<FieldOperationType>(
  FIELD_OPERATION_OPTIONS.map((item) => item.type),
);

/**
 * Eski ekranlarda kalan farklı adları tek TarlaPusula işlem sözlüğüne çevirir.
 * Aynı tarımsal işlem farklı ekranlarda farklı kayıt tipi üretmemelidir.
 */
export function normalizeFieldOperationType(value: unknown): FieldOperationType {
  const raw = String(value ?? '').trim();

  if (raw === 'Toprak İşleme' || raw === 'Toprak işleme' || raw === 'Sürüm') {
    return 'Sürme';
  }

  if (FIELD_OPERATION_TYPES.has(raw as FieldOperationType)) {
    return raw as FieldOperationType;
  }

  return 'Diğer';
}
