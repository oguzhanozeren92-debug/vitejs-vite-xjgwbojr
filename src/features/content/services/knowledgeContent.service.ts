import { supabase } from '../../../supabaseClient';

export type KnowledgeContentType =
  | 'image'
  | 'plant'
  | 'disease'
  | 'pest'
  | 'announcement'
  | 'guide';

export type KnowledgeContentRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_type: KnowledgeContentType;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveKnowledgeContentInput = {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  contentType: KnowledgeContentType;
  imageUrl?: string;
  isActive: boolean;
  sortOrder?: number;
};

const CONTENT_COLUMNS = [
  'id',
  'title',
  'description',
  'category',
  'content_type',
  'image_path',
  'image_url',
  'is_active',
  'sort_order',
  'created_by',
  'created_at',
  'updated_at',
].join(',');

export async function listActiveKnowledgeContent(): Promise<KnowledgeContentRow[]> {
  const { data, error } = await supabase
    .from('app_contents')
    .select(CONTENT_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as KnowledgeContentRow[];
}

export async function listAdminKnowledgeContent(): Promise<KnowledgeContentRow[]> {
  const { data, error } = await supabase
    .from('app_contents')
    .select(CONTENT_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as KnowledgeContentRow[];
}

export async function saveAdminKnowledgeContent(
  input: SaveKnowledgeContentInput,
): Promise<KnowledgeContentRow> {
  const title = input.title.trim();
  if (!title) throw new Error('İçerik başlığı zorunlu.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Admin oturumu bulunamadı.');

  const payload = {
    title,
    description: input.description?.trim() || null,
    category: input.category?.trim() || 'general',
    content_type: input.contentType,
    image_url: input.imageUrl?.trim() || null,
    is_active: Boolean(input.isActive),
    sort_order: Number.isFinite(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : 0,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('app_contents')
      .update(payload)
      .eq('id', input.id)
      .select(CONTENT_COLUMNS)
      .single();

    if (error) throw error;
    return data as unknown as KnowledgeContentRow;
  }

  const { data, error } = await supabase
    .from('app_contents')
    .insert(payload)
    .select(CONTENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as KnowledgeContentRow;
}

export async function setKnowledgeContentActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('app_contents')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAdminKnowledgeContent(id: string) {
  const { error } = await supabase.from('app_contents').delete().eq('id', id);
  if (error) throw error;
}
