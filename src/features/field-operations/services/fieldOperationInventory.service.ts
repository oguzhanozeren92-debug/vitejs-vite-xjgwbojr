import { supabase } from '../../../supabaseClient';

export type FieldOperationInventoryOption = {
  id: string;
  productName: string;
  category: 'ilac' | 'gubre';
  remainingAmount: number;
  unit: string;
  fieldIds: string[];
  linkedToField: boolean;
};

export async function listFieldOperationInventoryOptions({
  fieldId,
  operationType,
}: {
  fieldId: string;
  operationType: 'Gübreleme' | 'İlaçlama';
}): Promise<FieldOperationInventoryOption[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Depo ürünlerini görmek için giriş yapmalısın.');

  const category = operationType === 'Gübreleme' ? 'gubre' : 'ilac';

  const { data, error } = await supabase
    .from('farm_inventory_products')
    .select('id,product_name,category,remaining_amount,unit,field_ids,updated_at')
    .eq('user_id', authData.user.id)
    .eq('category', category)
    .gt('remaining_amount', 0)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row: any): FieldOperationInventoryOption => {
      const fieldIds = Array.isArray(row.field_ids)
        ? row.field_ids.map((value: unknown) => String(value))
        : [];

      return {
        id: String(row.id),
        productName: String(row.product_name ?? 'İsimsiz ürün'),
        category: row.category === 'gubre' ? 'gubre' : 'ilac',
        remainingAmount: Math.max(0, Number(row.remaining_amount ?? 0) || 0),
        unit: String(row.unit ?? ''),
        fieldIds,
        linkedToField: fieldIds.some((value) => value === fieldId),
      };
    })
    .sort((a, b) => {
      if (a.linkedToField !== b.linkedToField) return a.linkedToField ? -1 : 1;
      return a.productName.localeCompare(b.productName, 'tr');
    });
}
