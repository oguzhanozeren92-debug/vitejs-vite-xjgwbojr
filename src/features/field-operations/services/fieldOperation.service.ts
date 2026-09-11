import { supabase } from '../../../supabaseClient';

import type {
  FieldOperation,
  FieldOperationCreateInput,
  FieldOperationType,
} from '../types/fieldOperation';

function nullableText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableNumber(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function titleForType(type: FieldOperationType) {
  if (type === 'Saha Kontrolü') return 'Saha kontrolü yapıldı';
  if (type === 'Ekim / Dikim') return 'Ekim / dikim yapıldı';
  if (type === 'Diğer') return 'Tarla işlemi kaydedildi';
  return `${type} yapıldı`;
}

function mapOperation(row: any): FieldOperation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fieldId: String(row.field_id),
    type: String(row.activity_type),
    title: String(row.title),
    date: String(row.activity_date),
    productName: nullableText(row.product_name),
    quantity: nullableNumber(row.quantity),
    unit: nullableText(row.unit),
    cost: nullableNumber(row.cost),
    notes: nullableText(row.notes),
    createdAt: String(row.created_at),
  };
}

function localIsoDateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function listRecentFieldOperations(
  fieldIdInput: string,
  lookbackDays = 30,
  limit = 30,
): Promise<FieldOperation[]> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return [];
  }

  const safeLookback = Math.max(1, Math.min(180, Math.round(lookbackDays)));
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const since = localIsoDateOffset(-safeLookback);

  const { data, error } = await supabase
    .from('activities')
    .select(
      'id,user_id,field_id,activity_type,title,activity_date,product_name,quantity,unit,cost,notes,created_at',
    )
    .eq('field_id', fieldId)
    .eq('user_id', authData.user.id)
    .gte('activity_date', since)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data ?? []).map(mapOperation);
}

export async function createFieldOperation(
  input: FieldOperationCreateInput,
): Promise<FieldOperation> {
  const fieldId = String(input.fieldId ?? '').trim();
  const date = String(input.date ?? '').trim();

  if (!fieldId) throw new Error('İşlem için tarla seçilemedi.');
  if (!date) throw new Error('İşlem tarihini seç.');

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error('İşlem kaydetmek için oturum gerekli.');
  }

  const quantity = nullableNumber(input.quantity);
  const cost = nullableNumber(input.cost);

  if (quantity != null && quantity < 0) {
    throw new Error('Miktar sıfırdan küçük olamaz.');
  }

  if (cost != null && cost < 0) {
    throw new Error('Maliyet sıfırdan küçük olamaz.');
  }

  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: authData.user.id,
      field_id: fieldId,
      field_section_id: null,
      activity_type: input.type,
      title: titleForType(input.type),
      activity_date: date,
      product_name: nullableText(input.productName),
      quantity,
      unit: quantity == null ? null : nullableText(input.unit),
      cost,
      notes: nullableText(input.notes),
    })
    .select('*')
    .single();

  if (error) throw error;

  const operation = mapOperation(data);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp:field-operation-saved', {
        detail: { fieldId: operation.fieldId, operation },
      }),
    );

    /*
     * Ortak Field Context tüketicilerine de haber ver.
     * Sulama Motoru activities tablosundaki Sulama kaydını gerçek bağlam olarak
     * okuduğu için yeni kayıt sonrası eski kararı ekranda tutmamalı.
     */
    window.dispatchEvent(
      new CustomEvent('tp:field-context-updated', {
        detail: {
          fieldId: operation.fieldId,
          changedFields:
            operation.type === 'Sulama'
              ? ['activities', 'irrigation_history']
              : ['activities', 'field_operations'],
          source: 'field-operation',
        },
      }),
    );
  }

  return operation;
}
