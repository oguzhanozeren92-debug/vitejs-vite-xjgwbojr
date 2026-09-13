import { useCallback, useEffect, useState } from 'react';
import {
  listPublishedAgriNews,
  type AgriNewsRow,
} from '../services/agriNews.service';

export function useAgriNewsFeed() {
  const [items, setItems] = useState<AgriNewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listPublishedAgriNews();
      setItems(rows);
    } catch (cause) {
      setItems([]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Tarım gündemi alınamadı.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleUpdated = () => void refresh();
    window.addEventListener('tp-agri-news-updated', handleUpdated);

    return () => {
      window.removeEventListener('tp-agri-news-updated', handleUpdated);
    };
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
