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
    photoPath: nullableText(row.photo_path),
    aiAnalysis: row.ai_analysis ?? null,
    aiAnalyzedAt: nullableText(row.ai_analyzed_at),
    inventoryProductId: nullableText(row.inventory_product_id),
    inventoryConsumedAmount: nullableNumber(row.inventory_consumed_amount),
    inventoryConsumedUnit: nullableText(row.inventory_consumed_unit),
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

function emitFieldOperationChange(
  operation: Pick<FieldOperation, 'fieldId' | 'type'>,
  action: 'saved' | 'deleted',
  fullOperation?: FieldOperation,
) {
  if (typeof window === 'undefined') return;

  if (action === 'saved' && fullOperation) {
    window.dispatchEvent(
      new CustomEvent('tp:field-operation-saved', {
        detail: { fieldId: operation.fieldId, operation: fullOperation },
      }),
    );
  }

  if (action === 'deleted') {
    window.dispatchEvent(
      new CustomEvent('tp:field-operation-deleted', {
        detail: { fieldId: operation.fieldId },
      }),
    );
  }

  window.dispatchEvent(
    new CustomEvent('tp:field-context-updated', {
      detail: {
        fieldId: operation.fieldId,
        changedFields:
          operation.type === 'Sulama'
            ? ['activities', 'irrigation_history']
            : operation.type === 'Gübreleme' || operation.type === 'İlaçlama'
              ? ['activities', 'field_operations', 'inventory']
              : ['activities', 'field_operations'],
        source: `field-operation-${action}`,
      },
    }),
  );

  if (fullOperation?.inventoryProductId || action === 'deleted') {
    window.dispatchEvent(
      new CustomEvent('tp:inventory-updated', {
        detail: { fieldId: operation.fieldId, source: `field-operation-${action}` },
      }),
    );
  }
}

export async function listRecentFieldOperations(
  fieldIdInput: string,
  lookbackDays = 30,
  limit = 30,
): Promise<FieldOperation[]> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return [];

  const safeLookback = Math.max(1, Math.min(180, Math.round(lookbackDays)));
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const since = localIsoDateOffset(-safeLookback);

  const { data, error } = await supabase
    .from('activities')
    .select(
      'id,user_id,field_id,activity_type,title,activity_date,product_name,quantity,unit,cost,notes,photo_path,ai_analysis,ai_analyzed_at,inventory_product_id,inventory_consumed_amount,inventory_consumed_unit,created_at',
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

/**
 * TarlaPusula'da kullanıcı tarla işlemi yazan TEK kapı.
 *
 * İşlem bir depo ürünüyle bağlıysa activity kaydı + stok düşümü aynı server
 * transaction'ında yapılır. Böylece kullanıcı aynı gübre/ilaç kullanımını
 * Tarla Günlüğü ve Depo'ya iki kere girmek zorunda kalmaz.
 */
export async function createFieldOperation(
  input: FieldOperationCreateInput,
): Promise<FieldOperation> {
  const fieldId = String(input.fieldId ?? '').trim();
  const date = String(input.date ?? '').trim();

  if (!fieldId) throw new Error('İşlem için tarla seçilemedi.');
  if (!date) throw new Error('İşlem tarihini seç.');

  const quantity = nullableNumber(input.quantity);
  const cost = nullableNumber(input.cost);
  if (quantity != null && quantity < 0) throw new Error('Miktar sıfırdan küçük olamaz.');
  if (cost != null && cost < 0) throw new Error('Maliyet sıfırdan küçük olamaz.');

  const { data, error } = await supabase.rpc('tp_create_field_operation', {
    p_field_id: fieldId,
    p_activity_type: input.type,
    p_activity_date: date,
    p_product_name: nullableText(input.productName),
    p_quantity: quantity,
    p_unit: quantity == null ? null : nullableText(input.unit),
    p_cost: cost,
    p_notes: nullableText(input.notes),
    p_photo_path: nullableText(input.photoPath),
    p_ai_analysis: input.aiAnalysis ?? null,
    p_ai_analyzed_at:
      input.aiAnalysis == null
        ? null
        : nullableText(input.aiAnalyzedAt) ?? new Date().toISOString(),
    p_inventory_product_id: nullableText(input.inventoryProductId),
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('İşlem kaydedildi ancak kayıt bilgisi alınamadı.');

  const operation = mapOperation(row);
  emitFieldOperationChange(operation, 'saved', operation);
  return operation;
}

/**
 * Silme de aynı server kapısından geçer. Depodan düşülmüş bir kullanım varsa
 * aynı transaction içinde stoğa geri eklenir.
 */
export async function deleteFieldOperation(operationIdInput: string) {
  const operationId = String(operationIdInput ?? '').trim();
  if (!operationId) return;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('İşlem silmek için oturum gerekli.');
  }

  const { data: existing, error: readError } = await supabase
    .from('activities')
    .select('id,field_id,activity_type,photo_path,inventory_product_id')
    .eq('id', operationId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return;

  const { data: deleted, error } = await supabase.rpc('tp_delete_field_operation', {
    p_activity_id: operationId,
  });

  if (error) throw error;
  if (deleted === false) return;

  const photoPath = nullableText(existing.photo_path);
  if (photoPath) {
    try {
      await supabase.storage.from('field-activity-photos').remove([photoPath]);
    } catch (storageError) {
      console.warn('Silinen işlem fotoğrafı temizlenemedi:', storageError);
    }
  }

  emitFieldOperationChange(
    {
      fieldId: String(existing.field_id),
      type: String(existing.activity_type),
    },
    'deleted',
    existing.inventory_product_id
      ? ({
          fieldId: String(existing.field_id),
          type: String(existing.activity_type),
          inventoryProductId: String(existing.inventory_product_id),
        } as FieldOperation)
      : undefined,
  );
}
