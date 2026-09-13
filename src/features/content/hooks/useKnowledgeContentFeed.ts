import { useCallback, useEffect, useState } from 'react';
import {
  listActiveKnowledgeContent,
  type KnowledgeContentRow,
} from '../services/knowledgeContent.service';

export function useKnowledgeContentFeed() {
  const [items, setItems] = useState<KnowledgeContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listActiveKnowledgeContent();
      setItems(rows);
    } catch (cause) {
      setItems([]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Bilgi Merkezi içerikleri alınamadı.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleUpdated = () => void refresh();
    window.addEventListener('tp-knowledge-content-updated', handleUpdated);

    return () => {
      window.removeEventListener('tp-knowledge-content-updated', handleUpdated);
    };
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
