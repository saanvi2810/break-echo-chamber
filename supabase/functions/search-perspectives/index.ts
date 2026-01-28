import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NewsArticle {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  bias: 'left' | 'center' | 'right';
}

// Domain lists based on AllSides Media Bias Chart
const domainsByBias: Record<'left' | 'center' | 'right', string[]> = {
  left: [
    'nytimes.com', 'washingtonpost.com', 'cnn.com', 'nbcnews.com', 'npr.org',
    'abcnews.go.com', 'cbsnews.com', 'msnbc.com', 'theguardian.com', 'politico.com',
    'huffpost.com', 'vox.com', 'slate.com', 'theatlantic.com', 'thedailybeast.com',
  ],
  center: [
    'reuters.com', 'apnews.com', 'bbc.com', 'forbes.com', 'usatoday.com',
    'newsweek.com', 'thehill.com', 'axios.com', 'csmonitor.com', 'pbs.org',
  ],
  right: [
    'foxnews.com', 'nypost.com', 'wsj.com', 'washingtonexaminer.com', 'dailywire.com',
    'nationalreview.com', 'breitbart.com', 'newsmax.com', 'dailycaller.com', 'thefederalist.com',
    'washingtontimes.com', 'theblaze.com', 'foxbusiness.com', 'freebeacon.com', 'townhall.com',
  ],
};

function detectOutletFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    // Map common hostnames to readable names
    const nameMap: Record<string, string> = {
      'nytimes.com': 'New York Times',
      'washingtonpost.com': 'Washington Post',
      'cnn.com': 'CNN',
      'nbcnews.com': 'NBC News',
      'npr.org': 'NPR',
      'abcnews.go.com': 'ABC News',
      'cbsnews.com': 'CBS News',
      'msnbc.com': 'MSNBC',
      'theguardian.com': 'The Guardian',
      'politico.com': 'Politico',
      'huffpost.com': 'HuffPost',
      'vox.com': 'Vox',
      'slate.com': 'Slate',
      'theatlantic.com': 'The Atlantic',
      'thedailybeast.com': 'The Daily Beast',
      'reuters.com': 'Reuters',
      'apnews.com': 'AP News',
      'bbc.com': 'BBC',
      'forbes.com': 'Forbes',
      'usatoday.com': 'USA Today',
      'newsweek.com': 'Newsweek',
      'thehill.com': 'The Hill',
      'axios.com': 'Axios',
      'csmonitor.com': 'Christian Science Monitor',
      'pbs.org': 'PBS',
      'foxnews.com': 'Fox News',
      'nypost.com': 'New York Post',
      'wsj.com': 'Wall Street Journal',
      'washingtonexaminer.com': 'Washington Examiner',
      'dailywire.com': 'Daily Wire',
      'nationalreview.com': 'National Review',
      'breitbart.com': 'Breitbart',
      'newsmax.com': 'Newsmax',
      'dailycaller.com': 'Daily Caller',
      'thefederalist.com': 'The Federalist',
      'washingtontimes.com': 'Washington Times',
      'theblaze.com': 'The Blaze',
      'foxbusiness.com': 'Fox Business',
      'freebeacon.com': 'Free Beacon',
      'townhall.com': 'Townhall',
    };
    return nameMap[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    return 'Unknown Source';
  }
}

// Check if URL looks like an article (not homepage, author page, etc.)
function isArticlePath(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    
    if (path === '/' || path === '') return false;
    if (path.startsWith('/people') || path.startsWith('/author') || path.startsWith('/writers')) return false;
    if (path.includes('/tag/') || path.includes('/tags/') || path.includes('/topic/') || path.includes('/topics/')) return false;
    if (path.includes('/category/') || path.includes('/categories/') || path.includes('/section/')) return false;
    
    return path.length > 10;
  } catch {
    return false;
  }
}

// Use Firecrawl Search API with site: operators (like Google search)
async function searchWithFirecrawl(
  topic: string,
  bias: 'left' | 'center' | 'right',
  firecrawlKey: string
): Promise<NewsArticle[]> {
  const domains = domainsByBias[bias];
  
  // Build site: query string (like Google: "topic site:nytimes.com OR site:cnn.com")
  const siteFilters = domains.slice(0, 8).map(d => `site:${d}`).join(' OR ');
  const searchQuery = `${topic} (${siteFilters})`;
  
  console.log(`[${bias}] Firecrawl search: ${searchQuery.slice(0, 100)}...`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
        lang: 'en',
        country: 'us',
        tbs: 'qdr:w', // Last week
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${bias}] Firecrawl error:`, errorText);
      return [];
    }
    
    const data = await response.json();
    const results = data.data || [];
    
    console.log(`[${bias}] Firecrawl returned ${results.length} results`);
    
    const articles: NewsArticle[] = [];
    const allowedDomains = new Set(domains.map(d => d.toLowerCase()));
    
    for (const result of results) {
      const url = result.url;
      if (!url || typeof url !== 'string') continue;
      
      // Verify URL is from an allowed domain for this bias
      try {
        const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
        const isAllowed = [...allowedDomains].some(domain => 
          hostname === domain || hostname.endsWith('.' + domain)
        );
        
        if (!isAllowed) {
          console.log(`[${bias}] Skipping off-list domain: ${hostname}`);
          continue;
        }
      } catch {
        continue;
      }
      
      if (!isArticlePath(url)) {
        console.log(`[${bias}] Skipping non-article URL: ${url}`);
        continue;
      }
      
      const outlet = detectOutletFromUrl(url);
      
      // Clean up title - remove markdown artifacts
      let title = result.title || `Article from ${outlet}`;
      title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove markdown links
      title = title.replace(/[#*_`]/g, '').trim(); // Remove markdown formatting
      
      // Clean up snippet - extract readable text from markdown/description
      let snippet = '';
      if (result.markdown) {
        // Remove markdown formatting, links, images, etc.
        let cleanText = result.markdown
          .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
          .replace(/#{1,6}\s*/g, '') // Remove headers
          .replace(/[*_`~]/g, '') // Remove formatting chars
          .replace(/\n+/g, ' ') // Convert newlines to spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Skip accessibility/navigation text
        const skipPatterns = [
          /^(skip to|accessibility|enable accessibility|navigation|menu|search)/i,
          /^(left arrow|right arrow|previous|next)/i,
          /^\d+$/,
        ];
        
        // Find first substantial sentence (not navigation text)
        const sentences = cleanText.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (sentence.length > 50 && !skipPatterns.some(p => p.test(sentence))) {
            snippet = sentence.slice(0, 300);
            break;
          }
        }
        
        // Fallback: use cleaned text
        if (!snippet && cleanText.length > 50) {
          snippet = cleanText.slice(0, 300);
        }
      }
      
      // Fallback to description
      if (!snippet && result.description) {
        snippet = result.description.replace(/[#*_`]/g, '').trim();
      }
      
      articles.push({
        url,
        title,
        outlet,
        snippet: snippet || 'Click to read the full article.',
        bias,
      });
    }
    
    console.log(`[${bias}] Valid articles: ${articles.length}`);
    return articles;
    
  } catch (error) {
    console.error(`[${bias}] Firecrawl search failed:`, error);
    return [];
  }
}

// Fallback to Perplexity if Firecrawl unavailable
async function searchWithPerplexity(
  topic: string,
  bias: 'left' | 'center' | 'right',
  perplexityKey: string
): Promise<NewsArticle[]> {
  const domains = domainsByBias[bias].slice(0, 5);
  
  console.log(`[${bias}] Perplexity fallback search`);
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: `Find recent news articles about "${topic}" from major news outlets.`
        }
      ],
      search_recency_filter: 'week',
      search_domain_filter: domains,
    }),
  });

  if (!response.ok) {
    console.error(`[${bias}] Perplexity error`);
    return [];
  }

  const data = await response.json();
  const citations: string[] = data.citations || [];
  const content = data.choices?.[0]?.message?.content || '';
  
  const articles: NewsArticle[] = [];
  
  for (const url of citations) {
    if (!url || !url.startsWith('http')) continue;
    if (!isArticlePath(url)) continue;
    
    const outlet = detectOutletFromUrl(url);
    articles.push({
      url,
      title: `Article from ${outlet}`,
      outlet,
      snippet: content.slice(0, 200) + '...',
      bias,
    });
  }
  
  return articles;
}

// Search all biases in parallel
async function searchNews(topic: string, firecrawlKey: string | undefined, perplexityKey: string | undefined): Promise<NewsArticle[]> {
  console.log(`Searching all perspectives for: ${topic}`);
  
  const searchFn = async (bias: 'left' | 'center' | 'right') => {
    // Prefer Firecrawl (better site: filtering)
    if (firecrawlKey) {
      const results = await searchWithFirecrawl(topic, bias, firecrawlKey);
      if (results.length > 0) return results;
    }
    // Fallback to Perplexity
    if (perplexityKey) {
      return searchWithPerplexity(topic, bias, perplexityKey);
    }
    return [];
  };
  
  const [leftArticles, centerArticles, rightArticles] = await Promise.all([
    searchFn('left'),
    searchFn('center'),
    searchFn('right'),
  ]);
  
  console.log(`Total: left=${leftArticles.length}, center=${centerArticles.length}, right=${rightArticles.length}`);
  
  return [...leftArticles, ...centerArticles, ...rightArticles];
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  return articles.find(a => a.bias === bias);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!aiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching perspectives for topic:', topic);
    console.log('Firecrawl available:', !!firecrawlKey);
    console.log('Perplexity available:', !!perplexityKey);

    // Search for real news articles
    const realArticles = await searchNews(topic, firecrawlKey, perplexityKey);
    
    if (realArticles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No verified articles found for this topic. Try a different search term.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Build perspectives from real articles
    const leftArticle = pickByBias(realArticles, 'left');
    const centerArticle = pickByBias(realArticles, 'center');
    const rightArticle = pickByBias(realArticles, 'right');

    const perspectives = [
      {
        perspective: 'left',
        label: 'Left-Leaning Source',
        outlet: leftArticle?.outlet || 'No left-leaning sources found',
        headline: leftArticle?.title || 'No article found',
        summary: leftArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: leftArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'center',
        label: 'Center Source',
        outlet: centerArticle?.outlet || 'No center sources found',
        headline: centerArticle?.title || 'No article found',
        summary: centerArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: centerArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'right',
        label: 'Right-Leaning Source',
        outlet: rightArticle?.outlet || 'No right-leaning sources found',
        headline: rightArticle?.title || 'No article found',
        summary: rightArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: rightArticle?.url || '',
        factChecks: [],
      },
    ];

    // Get topic metadata from AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. Provide a short title, one-sentence description, and 3 tags. Example: {"title":"...","description":"...","tags":["...","...","..."]}'
          },
          { role: 'user', content: `Generate metadata for topic: "${topic}"` }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    let topicMetadata = {
      title: topic,
      description: `Coverage of ${topic}`,
      tags: ['News', 'Politics', 'Current Events']
    };

    if (response.ok) {
      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          topicMetadata = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse topic metadata:', e);
        }
      }
    }

    const parsedContent = {
      topic: { ...topicMetadata, date: currentDate },
      perspectives
    };

    // Search for fact-checks using Google Fact Check API
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    
    if (factCheckApiKey) {
      console.log('Searching fact-checks for each article...');
      
      await Promise.all(parsedContent.perspectives.map(async (perspective: any) => {
        perspective.factChecks = [];
        
        if (!perspective.headline && !perspective.summary) return;
        
        try {
          const query = perspective.headline || perspective.summary?.slice(0, 100);
          const encodedQuery = encodeURIComponent(query.slice(0, 150));
          const fcResponse = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
            { method: 'GET' }
          );
          
          if (!fcResponse.ok) return;
          
          const fcData = await fcResponse.json();
          const claims = fcData.claims || [];
          
          for (const claim of claims.slice(0, 3)) {
            const review = claim.claimReview?.[0];
            if (!review || !review.url) continue;
            
            const rating = (review.textualRating || '').toLowerCase();
            let status = 'disputed';
            if (rating.includes('true') || rating.includes('correct')) status = 'verified';
            else if (rating.includes('false') || rating.includes('wrong')) status = 'false';
            
            perspective.factChecks.push({
              claimText: claim.text || '',
              claimant: claim.claimant || 'Unknown',
              rating: review.textualRating || '',
              status,
              source: review.publisher?.name || 'Fact Checker',
              sourceUrl: review.url || '',
              title: review.title || '',
            });
          }
          
          console.log(`${perspective.perspective}: ${perspective.factChecks.length} fact-checks`);
        } catch (fcError) {
          console.error(`Fact-check error for ${perspective.perspective}:`, fcError);
        }
      }));
    }

    console.log('Successfully analyzed topic with real articles');

    return new Response(
      JSON.stringify({ success: true, data: parsedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in search-perspectives:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
