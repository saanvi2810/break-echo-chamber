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

export interface Perspective {
  perspective: 'left' | 'center' | 'right';
  label: string;
  outlet: string;
  headline: string;
  summary: string;
  timeAgo: string;
  articleUrl: string;
  factChecks?: FactCheck[];
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

interface Article {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  perspective: 'left' | 'center' | 'right';
  label: string;
}

interface PerspectiveSearchResponse {
  success: boolean;
  articles: Article[];
  error?: string;
}

function articleToPerspective(article: Article): Perspective {
  return {
    perspective: article.perspective,
    label: article.label,
    outlet: article.outlet,
    headline: article.title,
    summary: article.snippet,
    timeAgo: 'Recent',
    articleUrl: article.url,
  };
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function searchPerspectives(
  topic: string,
  onRetry?: (attempt: number) => void
): Promise<SearchResult> {
  let retryCount = 0;

  try {
    const result = await withRetry(
      async () => {
        // Stagger requests with 1-second delays to avoid Brave rate limits
        const leftRes = await supabase.functions.invoke<PerspectiveSearchResponse>('search-left', {
          body: { topic },
        });
        
        await delay(1000);
        
        const centerRes = await supabase.functions.invoke<PerspectiveSearchResponse>('search-center', {
          body: { topic },
        });
        
        await delay(1000);
        
        const rightRes = await supabase.functions.invoke<PerspectiveSearchResponse>('search-right', {
          body: { topic },
        });

        // Log any errors but don't fail entirely if one perspective fails
        if (leftRes.error) console.error('[LEFT] Error:', leftRes.error);
        if (centerRes.error) console.error('[CENTER] Error:', centerRes.error);
        if (rightRes.error) console.error('[RIGHT] Error:', rightRes.error);

        // Extract articles from each response
        const leftArticles = leftRes.data?.articles || [];
        const centerArticles = centerRes.data?.articles || [];
        const rightArticles = rightRes.data?.articles || [];

        console.log(`[PERSPECTIVES] Left: ${leftArticles.length}, Center: ${centerArticles.length}, Right: ${rightArticles.length}`);

        // Convert articles to perspectives
        const perspectives: Perspective[] = [
          ...leftArticles.map(articleToPerspective),
          ...centerArticles.map(articleToPerspective),
          ...rightArticles.map(articleToPerspective),
        ];

        // Check if we have at least some results
        if (perspectives.length === 0) {
          throw new Error('No articles found from any perspective');
        }

        // Build response
        const response: PerspectivesResponse = {
          topic: {
            title: topic,
            description: `Analysis of "${topic}" from multiple perspectives`,
            date: new Date().toISOString().split('T')[0],
            tags: [],
          },
          perspectives,
          factChecks: [],
        };

        return response;
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
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
