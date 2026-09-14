import { supabase } from '../../../supabaseClient';

export type AgriNewsDbCategory =
  | 'support'
  | 'varieties'
  | 'disease'
  | 'general';

export type AgriNewsRaw = {
  actionText?: string;
  actionScreen?: string;
  tags?: string[];
  recommendedRegions?: string[];
};

export type AgriNewsRow = {
  id: string;
  external_id: string | null;
  title: string;
  summary: string | null;
  category: AgriNewsDbCategory;
  source_type: 'official' | 'admin' | 'user';
  source_name: string;
  source_url: string;
  image_url: string | null;
  published_at: string | null;
  author_id: string | null;
  is_published: boolean;
  raw: AgriNewsRaw | null;
  created_at: string;
  updated_at: string;
};

export type SaveAgriNewsInput = {
  id?: string;
  title: string;
  summary?: string;
  category: AgriNewsDbCategory;
  sourceName?: string;
  sourceUrl?: string;
  imageUrl?: string;
  publishedAt?: string | null;
  isPublished: boolean;
  actionText?: string;
  actionScreen?: string;
  tags?: string[];
  recommendedRegions?: string[];
};

const NEWS_COLUMNS = [
  'id',
  'external_id',
  'title',
  'summary',
  'category',
  'source_type',
  'source_name',
  'source_url',
  'image_url',
  'published_at',
  'author_id',
  'is_published',
  'raw',
  'created_at',
  'updated_at',
].join(',');

function cleanList(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function sortNews(rows: AgriNewsRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(a.published_at ?? a.created_at ?? '') || 0;
    const bTime = Date.parse(b.published_at ?? b.created_at ?? '') || 0;
    return bTime - aTime;
  });
}

export async function listPublishedAgriNews(): Promise<AgriNewsRow[]> {
  const { data, error } = await supabase
    .from('agri_news')
    .select(NEWS_COLUMNS)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return sortNews((data ?? []) as unknown as AgriNewsRow[]);
}

export async function listAdminAgriNews(): Promise<AgriNewsRow[]> {
  const { data, error } = await supabase
    .from('agri_news')
    .select(NEWS_COLUMNS)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return sortNews((data ?? []) as unknown as AgriNewsRow[]);
}

export async function saveAdminAgriNews(
  input: SaveAgriNewsInput,
): Promise<AgriNewsRow> {
  const title = input.title.trim();
  if (!title) throw new Error('Haber başlığı zorunlu.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Admin oturumu bulunamadı.');

  const raw: AgriNewsRaw = {
    actionText: input.actionText?.trim() || undefined,
    actionScreen: input.actionScreen?.trim() || undefined,
    tags: cleanList(input.tags),
    recommendedRegions: cleanList(input.recommendedRegions),
  };

  const payload = {
    title,
    summary: input.summary?.trim() || null,
    category: input.category,
    source_type: 'admin' as const,
    source_name: input.sourceName?.trim() || 'TarlaPusula',
    source_url: input.sourceUrl?.trim() || '',
    image_url: input.imageUrl?.trim() || null,
    published_at: input.isPublished
      ? input.publishedAt || new Date().toISOString()
      : input.publishedAt || null,
    author_id: userId,
    is_published: Boolean(input.isPublished),
    raw,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('agri_news')
      .update(payload)
      .eq('id', input.id)
      .select(NEWS_COLUMNS)
      .single();

    if (error) throw error;
    return data as unknown as AgriNewsRow;
  }

  const { data, error } = await supabase
    .from('agri_news')
    .insert(payload)
    .select(NEWS_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as AgriNewsRow;
}

export async function setAgriNewsPublished(id: string, isPublished: boolean) {
  const { error } = await supabase
    .from('agri_news')
    .update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAdminAgriNews(id: string) {
  const { error } = await supabase.from('agri_news').delete().eq('id', id);
  if (error) throw error;
}
