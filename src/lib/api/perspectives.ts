import { supabase } from '@/integrations/supabase/client';

export interface Claim {
  text: string;
  status: 'verified' | 'disputed' | 'false';
  source: string;
  sourceUrl: string;
}

export interface Perspective {
  perspective: 'left' | 'center' | 'right';
  label: string;
  outlet: string;
  headline: string;
  summary: string;
  timeAgo: string;
  claims: Claim[];
  articleUrl: string;
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
}

export async function searchPerspectives(topic: string): Promise<PerspectivesResponse> {
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

  return data.data;
}
