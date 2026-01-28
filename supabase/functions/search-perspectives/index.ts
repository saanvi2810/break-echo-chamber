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

// Build a hostname → bias lookup
const domainToBias: Record<string, 'left' | 'center' | 'right'> = {};
for (const bias of ['left', 'center', 'right'] as const) {
  for (const d of domainsByBias[bias]) {
    domainToBias[d.toLowerCase()] = bias;
  }
}

function detectOutletFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
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

function getBiasForUrl(url: string): 'left' | 'center' | 'right' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    if (domainToBias[hostname]) return domainToBias[hostname];
    for (const d of Object.keys(domainToBias)) {
      if (hostname.endsWith('.' + d)) return domainToBias[d];
    }
    return null;
  } catch {
    return null;
  }
}

// ============ GOOGLE CUSTOM SEARCH API (PRIMARY) ============

async function searchGoogleCSE(
  topic: string,
  bias: 'left' | 'center' | 'right',
  googleApiKey: string,
  googleCseId: string
): Promise<NewsArticle[]> {
  const domains = domainsByBias[bias];
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Google CSE allows site restriction via siteSearch parameter or in query
  // We'll use the query approach with site: operators
  const siteFilters = domains.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const query = `${topicClean} (${siteFilters})`;
  
  const params = new URLSearchParams({
    key: googleApiKey,
    cx: googleCseId,
    q: query,
    num: '10',
    dateRestrict: 'w1', // Last week
    safe: 'active',
  });

  console.log(`[${bias}] Google CSE search: ${topicClean.slice(0, 50)}...`);

  try {
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${bias}] Google CSE error: ${response.status} - ${errorText.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const items = data.items || [];
    
    console.log(`[${bias}] Google CSE returned ${items.length} results`);

    const articles: NewsArticle[] = [];
    for (const item of items) {
      const url = item.link;
      if (!url || !isArticlePath(url)) continue;
      
      const detectedBias = getBiasForUrl(url);
      if (detectedBias !== bias) continue;

      const outlet = detectOutletFromUrl(url);
      const title = item.title || `Article from ${outlet}`;
      const snippet = item.snippet || title;

      articles.push({ url, title, outlet, snippet, bias });
    }

    return articles;
  } catch (error) {
    console.error(`[${bias}] Google CSE fetch error:`, error);
    return [];
  }
}

// Search all biases in parallel with Google CSE
async function searchAllGoogleCSE(
  topic: string,
  googleApiKey: string,
  googleCseId: string
): Promise<NewsArticle[]> {
  console.log('Using Google Custom Search API (primary)');
  
  const [left, center, right] = await Promise.all([
    searchGoogleCSE(topic, 'left', googleApiKey, googleCseId),
    searchGoogleCSE(topic, 'center', googleApiKey, googleCseId),
    searchGoogleCSE(topic, 'right', googleApiKey, googleCseId),
  ]);

  const articles = [...left, ...center, ...right];
  
  console.log(`Google CSE total: left=${left.length}, center=${center.length}, right=${right.length}`);
  
  return articles;
}

// ============ FIRECRAWL FALLBACK ============

async function searchFirecrawlForBias(
  topic: string,
  bias: 'left' | 'center' | 'right',
  firecrawlKey: string
): Promise<NewsArticle[]> {
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  const domains = domainsByBias[bias];
  const siteFilters = domains.map(d => `site:${d}`).join(' OR ');
  const query = `${topicClean} (${siteFilters})`;

  console.log(`[${bias}] Firecrawl fallback search`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 8,
        lang: 'en',
        tbs: 'qdr:w',
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${bias}] Firecrawl error: ${errorText.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const results = data.data || [];
    
    const articles: NewsArticle[] = [];
    for (const result of results) {
      const url = result?.url;
      if (!url || !isArticlePath(url)) continue;
      if (getBiasForUrl(url) !== bias) continue;

      const outlet = detectOutletFromUrl(url);
      let title = result.title || `Article from ${outlet}`;
      title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`]/g, '').trim();
      
      let snippet = result.description || result.markdown?.slice(0, 300) || title;
      snippet = snippet.replace(/[#*_`]/g, '').trim();

      articles.push({ url, title, outlet, snippet, bias });
    }

    console.log(`[${bias}] Firecrawl found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`[${bias}] Firecrawl fetch error:`, error);
    return [];
  }
}

// ============ PERPLEXITY LAST RESORT ============

async function searchPerplexityForBias(
  topic: string,
  bias: 'left' | 'center' | 'right',
  perplexityKey: string
): Promise<NewsArticle[]> {
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  const domains = domainsByBias[bias];
  const siteFilters = domains.map(d => `site:${d}`).join(' OR ');
  const query = `${topicClean} (${siteFilters})`;

  console.log(`[${bias}] Perplexity last-resort search`);

  try {
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
            content: `Find recent news articles about: ${query}. Return article links only.`
          }
        ],
        search_recency_filter: 'week',
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${bias}] Perplexity error: ${err.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const citations = (data.citations || []) as string[];
    const content = data.choices?.[0]?.message?.content || '';

    const articles: NewsArticle[] = [];
    for (const url of citations) {
      if (!url || !url.startsWith('http')) continue;
      if (!isArticlePath(url)) continue;
      if (getBiasForUrl(url) !== bias) continue;
      
      const outlet = detectOutletFromUrl(url);
      articles.push({
        url,
        title: `Article from ${outlet}`,
        outlet,
        snippet: content.slice(0, 220) + '...',
        bias,
      });
    }

    console.log(`[${bias}] Perplexity found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`[${bias}] Perplexity fetch error:`, error);
    return [];
  }
}

// ============ MAIN SEARCH ORCHESTRATOR ============

async function searchNews(
  topic: string,
  googleApiKey: string | undefined,
  googleCseId: string | undefined,
  firecrawlKey: string | undefined,
  perplexityKey: string | undefined
): Promise<NewsArticle[]> {
  console.log(`Searching perspectives for: ${topic}`);

  let articles: NewsArticle[] = [];

  // PRIMARY: Google Custom Search API (most reliable)
  if (googleApiKey && googleCseId) {
    articles = await searchAllGoogleCSE(topic, googleApiKey, googleCseId);
  }

  // Helper to check if we have articles for a bias
  const hasBias = (b: 'left' | 'center' | 'right') => articles.some(a => a.bias === b);
  const missingBiases = (['left', 'center', 'right'] as const).filter(b => !hasBias(b));

  // FALLBACK: Firecrawl for missing biases
  if (missingBiases.length > 0 && firecrawlKey) {
    console.log(`Filling missing biases with Firecrawl: ${missingBiases.join(', ')}`);
    const firecrawlResults = await Promise.all(
      missingBiases.map(b => searchFirecrawlForBias(topic, b, firecrawlKey))
    );
    articles = [...articles, ...firecrawlResults.flat()];
  }

  // Recheck missing biases
  const stillMissing = (['left', 'center', 'right'] as const).filter(b => !hasBias(b));

  // LAST RESORT: Perplexity for still-missing biases
  if (stillMissing.length > 0 && perplexityKey) {
    console.log(`Filling still-missing biases with Perplexity: ${stillMissing.join(', ')}`);
    const perplexityResults = await Promise.all(
      stillMissing.map(b => searchPerplexityForBias(topic, b, perplexityKey))
    );
    articles = [...articles, ...perplexityResults.flat()];
  }

  // Dedupe by URL
  const seen = new Set<string>();
  const deduped = articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`Final: left=${deduped.filter(a => a.bias === 'left').length}, center=${deduped.filter(a => a.bias === 'center').length}, right=${deduped.filter(a => a.bias === 'right').length}`);
  return deduped;
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  return articles.find(a => a.bias === bias);
}

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    'the','a','an','and','or','but','to','of','in','on','for','with','from','by','at','as','is','are','was','were','be','been',
    'this','that','these','those','it','its','their','they','them','he','she','his','her','you','your','we','our','us',
    'calls','call','says','said','tells','told','latest','breaking','report','reports','news','video','live','update',
  ]);
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  const keywords = tokens
    .filter(t => t.length >= 4 && !stop.has(t))
    .slice(0, 20);
  return Array.from(new Set(keywords));
}

function isFactCheckRelevant(opts: {
  topic: string;
  headline: string;
  claimText: string;
  reviewTitle: string;
}): boolean {
  const topicKeys = extractKeywords(opts.topic);
  const headKeys = extractKeywords(opts.headline);
  const keys = Array.from(new Set([...topicKeys, ...headKeys])).slice(0, 25);

  const hay = normalizeText(`${opts.claimText} ${opts.reviewTitle}`);
  if (!hay) return false;

  const topicMatches = topicKeys.filter(k => hay.includes(k)).length;
  if (topicKeys.length > 0 && topicMatches === 0) return false;

  const totalMatches = keys.filter(k => hay.includes(k)).length;
  return totalMatches >= 2;
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
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleCseId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!aiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching perspectives for topic:', topic);
    console.log('Google CSE available:', !!(googleApiKey && googleCseId));
    console.log('Firecrawl available:', !!firecrawlKey);
    console.log('Perplexity available:', !!perplexityKey);

    const realArticles = await searchNews(topic, googleApiKey, googleCseId, firecrawlKey, perplexityKey);

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
          const query = `${topic} ${perspective.headline || ''}`.trim();
          const encodedQuery = encodeURIComponent(query.slice(0, 150));
          const fcResponse = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
            { method: 'GET' }
          );

          if (!fcResponse.ok) return;

          const fcData = await fcResponse.json();
          const claims = fcData.claims || [];

          for (const claim of claims.slice(0, 10)) {
            const review = claim.claimReview?.[0];
            if (!review || !review.url) continue;

            const claimText = claim.text || '';
            const reviewTitle = review.title || '';

            if (!isFactCheckRelevant({ topic, headline: perspective.headline || '', claimText, reviewTitle })) {
              continue;
            }

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

            if (perspective.factChecks.length >= 3) break;
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
