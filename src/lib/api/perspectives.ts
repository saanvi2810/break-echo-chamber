import { supabase } from '@/integrations/supabase/client';
import { withRetry, getNetworkErrorMessage, isNetworkError } from '@/lib/utils/retry';

export interface FactCheck {
  claimText: string;
  claimant: string;
  rating: string;
  status: 'verified' | 'disputed' | 'false';
  source: string;
  sourceUrl: string;
  title: string;
}

export interface Article {
  outlet: string;
  headline: string;
  summary: string;
  timeAgo: string;
  articleUrl: string;
  factChecks?: FactCheck[];
}

export interface Perspective {
  perspective: 'left' | 'center' | 'right';
  label: string;
  articles: Article[];
}

export interface TopicData {
  title: string;
  description: string;
  date: string;
  tags: string[];
}

export interface PerspectivesResponse {
  topic: TopicData;
  perspectives: Perspective[];
  factChecks: FactCheck[];
}

export interface SearchResult {
  data?: PerspectivesResponse;
  error?: string;
  isNetworkError?: boolean;
  retryCount?: number;
}

export async function searchPerspectives(
  topic: string,
  onRetry?: (attempt: number) => void
): Promise<SearchResult> {
  let retryCount = 0;

  try {
    const result = await withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke('search-perspectives', {
          body: { topic },
        });

        if (error) {
          console.error('Error fetching perspectives:', error);
          throw new Error(error.message || 'Failed to fetch perspectives');
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to analyze topic');
        }

        return data.data as PerspectivesResponse;
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 8000,
        onRetry: (attempt, error) => {
          retryCount = attempt;
          console.log(`Retry attempt ${attempt} after error:`, error.message);
          onRetry?.(attempt);
        },
      }
    );

    return { data: result, retryCount };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const networkError = isNetworkError(err);
    
    return {
      error: networkError ? getNetworkErrorMessage(err) : err.message,
      isNetworkError: networkError,
      retryCount,
    };
  }
}
