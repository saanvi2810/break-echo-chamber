import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PerplexityResult {
  url: string;
  title: string;
  snippet: string;
}

interface NewsArticle {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  bias?: 'left' | 'center' | 'right';
}

// Known outlet bias mapping
const outletBias: Record<string, 'left' | 'center' | 'right'> = {
  // Left-leaning
  'msnbc': 'left', 'huffpost': 'left', 'huffington post': 'left', 'the guardian': 'left',
  'vox': 'left', 'slate': 'left', 'daily beast': 'left', 'mother jones': 'left',
  'the atlantic': 'left', 'new york times': 'left', 'washington post': 'left',
  'cnn': 'left', 'nbc news': 'left', 'abc news': 'left', 'cbs news': 'left',
  'npr': 'left', 'politico': 'left', 'buzzfeed': 'left',
  // Center
  'reuters': 'center', 'ap news': 'center', 'associated press': 'center',
  'bbc': 'center', 'pbs': 'center', 'usa today': 'center', 'axios': 'center',
  'the hill': 'center', 'newsweek': 'center', 'time': 'center',
  // Right-leaning
  'fox news': 'right', 'wall street journal': 'right', 'wsj': 'right',
  'new york post': 'right', 'daily wire': 'right', 'breitbart': 'right',
  'the blaze': 'right', 'daily caller': 'right', 'washington examiner': 'right',
  'national review': 'right', 'the federalist': 'right', 'newsmax': 'right',
  'one america news': 'right', 'oan': 'right', 'epoch times': 'right',
};

function detectOutletFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const parts = hostname.split('.');
    return parts.slice(0, -1).join(' ').replace(/-/g, ' ');
  } catch {
    return 'Unknown Source';
  }
}

function detectBias(outlet: string, url: string): 'left' | 'center' | 'right' {
  const lowerOutlet = outlet.toLowerCase();
  const lowerUrl = url.toLowerCase();
  
  for (const [name, bias] of Object.entries(outletBias)) {
    if (lowerOutlet.includes(name) || lowerUrl.includes(name.replace(/\s+/g, ''))) {
      return bias;
    }
  }
  return 'center';
}

// Domain lists based on AllSides Media Bias Chart + common news sources
// PRIORITIZED: Major mainstream outlets FIRST (most likely to have articles on current topics)
// LEFT = Lean Left + Left sources
// CENTER = Center sources  
// RIGHT = Lean Right + Right sources
const domainsByBias: Record<'left' | 'center' | 'right', string[]> = {
  // Left/Lean Left - MAJOR OUTLETS FIRST
  left: [
    // Major mainstream (highest priority - most likely to have current news)
    'nytimes.com', 'washingtonpost.com', 'cnn.com', 'nbcnews.com', 'npr.org',
    'abcnews.go.com', 'cbsnews.com', 'msnbc.com', 'theguardian.com', 'politico.com',
    // Secondary mainstream
    'thehill.com', 'axios.com', 'vox.com', 'slate.com', 'theatlantic.com',
    'huffpost.com', 'thedailybeast.com', 'bloomberg.com', 'time.com', 'usatoday.com',
    // Other left-leaning
    'motherjones.com', 'theintercept.com', 'jacobin.com', 'thenation.com', 'democracynow.org',
    'propublica.org', 'newyorker.com', 'insider.com', 'businessinsider.com',
  ],
  // Center - WIRE SERVICES & MAJOR CENTER OUTLETS FIRST
  center: [
    // Wire services & major center (highest priority)
    'reuters.com', 'apnews.com', 'bbc.com', 'wsj.com', 'forbes.com',
    'newsweek.com', 'usatoday.com', 'thehill.com', 'axios.com',
    // Other center
    'csmonitor.com', 'marketwatch.com', 'newsnationnow.com', 'reason.com',
    'foreignaffairs.com', 'cfr.org', 'brookings.edu', 'csis.org',
    'politifact.com', 'factcheck.org', 'snopes.com',
  ],
  // Right/Lean Right - MAJOR OUTLETS FIRST
  right: [
    // Major mainstream right (highest priority)
    'foxnews.com', 'nypost.com', 'wsj.com', 'washingtonexaminer.com', 'dailywire.com',
    'nationalreview.com', 'foxbusiness.com', 'breitbart.com', 'newsmax.com',
    // Secondary right
    'dailycaller.com', 'thefederalist.com', 'washingtontimes.com', 'theblaze.com',
    'dailymail.co.uk', 'nypost.com', 'realclearpolitics.com', 'freebeacon.com',
    // Other right-leaning
    'townhall.com', 'redstate.com', 'hotair.com', 'pjmedia.com', 'oann.com',
    'theepochtimes.com', 'spectator.org', 'theamericanconservative.com',
  ],
};

// Classify a URL's bias based on our domain lists
function classifyUrlBias(url: string): 'left' | 'center' | 'right' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    
    // Helper to check if hostname matches domain
    const matchesDomain = (domain: string) => {
      const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
      return hostname === cleanDomain || 
             hostname.endsWith('.' + cleanDomain) ||
             hostname.includes(cleanDomain);
    };
    
    for (const domain of domainsByBias.left) {
      if (matchesDomain(domain)) return 'left';
    }
    for (const domain of domainsByBias.center) {
      if (matchesDomain(domain)) return 'center';
    }
    for (const domain of domainsByBias.right) {
      if (matchesDomain(domain)) return 'right';
    }
    return null;
  } catch {
    return null;
  }
}

// Check if URL looks like an article (not homepage, author page, etc.)
function isArticlePath(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    
    // Reject non-article paths
    if (path === '/' || path === '') return false;
    if (path.startsWith('/people') || path.startsWith('/author') || path.startsWith('/writers')) return false;
    if (path.includes('/tag/') || path.includes('/tags/') || path.includes('/topic/') || path.includes('/topics/')) return false;
    if (path.includes('/category/') || path.includes('/categories/') || path.includes('/section/')) return false;
    
    // Article paths usually have dates or specific slugs
    return path.length > 10;
  } catch {
    return false;
  }
}

// Search a specific bias category by constraining to those domains
async function searchByBias(
  topic: string, 
  bias: 'left' | 'center' | 'right',
  perplexityKey: string
): Promise<NewsArticle[]> {
  const domains = domainsByBias[bias];
  // Perplexity limits to 5 domains per request, so pick top ones
  const topDomains = domains.slice(0, 5);
  
  console.log(`Searching ${bias} sources for: ${topic} (domains: ${topDomains.join(', ')})`);

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
          content: `Find recent news articles about "${topic}" from major news outlets. Summarize what each source reports.`
        }
      ],
      search_recency_filter: 'week',
      search_domain_filter: topDomains,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Perplexity ${bias} search error:`, errorText);
    return [];
  }

  const data = await response.json();
  const citations: string[] = data.citations || [];
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log(`${bias} search found ${citations.length} citations`);
  if (citations.length > 0) {
    console.log(`${bias} citations:`, citations.slice(0, 3));
  }

  const articles: NewsArticle[] = [];
  
  for (const url of citations) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
    if (!isArticlePath(url)) {
      console.log(`Skipping non-article URL: ${url}`);
      continue;
    }
    
    const outlet = detectOutletFromUrl(url);
    
    // Extract summary for this source from content
    const outletLower = outlet.toLowerCase();
    const summaryPatterns = [
      new RegExp(`${outletLower}[^.]*(?:reports?|says?|states?)[^.]+\\.`, 'i'),
      new RegExp(`according to ${outletLower}[^.]+\\.`, 'i'),
    ];
    
    let snippet = '';
    for (const pattern of summaryPatterns) {
      const match = content.match(pattern);
      if (match) {
        snippet = match[0].trim();
        break;
      }
    }
    
    // If no specific snippet found, use first ~200 chars of content
    if (!snippet && content) {
      snippet = content.slice(0, 200).trim() + '...';
    }
    
    articles.push({
      url,
      title: `Article from ${outlet}`,
      outlet,
      snippet,
      bias,
    });
  }
  
  console.log(`${bias} articles found: ${articles.length}`);
  return articles;
}

// Search all three bias categories in parallel
async function searchNews(topic: string, perplexityKey: string): Promise<NewsArticle[]> {
  console.log(`Searching all perspectives for: ${topic}`);
  
  const [leftArticles, centerArticles, rightArticles] = await Promise.all([
    searchByBias(topic, 'left', perplexityKey),
    searchByBias(topic, 'center', perplexityKey),
    searchByBias(topic, 'right', perplexityKey),
  ]);
  
  const allArticles = [...leftArticles, ...centerArticles, ...rightArticles];
  console.log(`Total articles: left=${leftArticles.length}, center=${centerArticles.length}, right=${rightArticles.length}`);
  
  return allArticles;
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  const candidates = articles.filter((a) => a.bias === bias);
  // Never fall back to a different bias; that causes mixing.
  return candidates[0];
}

// Known fact-checking domains - URLs from these should be preserved
const factCheckDomains = [
  'snopes.com', 'politifact.com', 'factcheck.org', 'fullfact.org',
  'checkyourfact.com', 'leadstories.com', 'reuters.com/fact-check',
  'apnews.com/hub/ap-fact-check', 'washingtonpost.com/news/fact-checker',
  'bbc.com/news/reality_check', 'usatoday.com/news/factcheck',
];

function isFactCheckUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  return factCheckDomains.some(domain => lowerUrl.includes(domain));
}

function enforceRealArticleUrls(parsedContent: any, realArticles: NewsArticle[]) {
  // Only enforce article URLs - DO NOT touch claim sourceUrls (those come from Google Fact Check API)
  if (!parsedContent?.perspectives || !Array.isArray(parsedContent.perspectives) || realArticles.length === 0) return;

  const allowedUrls = new Set(realArticles.map((a) => a.url));
  const left = pickByBias(realArticles, 'left');
  const center = pickByBias(realArticles, 'center');
  const right = pickByBias(realArticles, 'right');

  const fallbackFor = (p: any): NewsArticle | undefined => {
    if (p?.perspective === 'left') return left;
    if (p?.perspective === 'center') return center;
    if (p?.perspective === 'right') return right;
    return undefined;
  };

  parsedContent.perspectives.forEach((p: any) => {
    const chosen = fallbackFor(p);
    if (!chosen) {
      const label = p?.perspective === 'left'
        ? 'No left-leaning articles found'
        : p?.perspective === 'center'
          ? 'No center articles found'
          : 'No right-leaning articles found';

      p.outlet = label;
      p.headline = label;
      p.summary = label;
      p.articleUrl = '';
      return;
    }

    // Enforce articleUrl only
    if (!p.articleUrl || typeof p.articleUrl !== 'string' || !allowedUrls.has(p.articleUrl)) {
      p.articleUrl = chosen.url;
    }

    // Enforce outlet/headline when missing (or clearly placeholder)
    if (!p.outlet || typeof p.outlet !== 'string' || p.outlet.toLowerCase().includes('example')) {
      p.outlet = chosen.outlet;
    }
    if (!p.headline || typeof p.headline !== 'string' || p.headline.toLowerCase().includes('realistic headline')) {
      p.headline = chosen.title;
    }
    
    // DO NOT modify claim sourceUrls here - let fact-check API populate them
  });
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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching perspectives for topic:', topic);

    // Search for real news articles using Perplexity
    let realArticles: NewsArticle[] = [];
    if (perplexityKey) {
      try {
        realArticles = await searchNews(topic, perplexityKey);
        console.log(`Found ${realArticles.length} real articles`);
      } catch (e) {
        console.error('Perplexity search failed:', e);
      }
    } else {
      console.log('Perplexity API key not configured, skipping real article search');
    }

    // Hard stop: never let the AI fabricate outlets/URLs.
    // If we couldn't find any verified, classified, real article URLs, return a clear error.
    if (realArticles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No verified articles found from the approved outlet lists for this topic. Try a broader query or a different topic.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // BYPASS AI: Use only Perplexity's raw output for article info
    // Build perspectives directly from realArticles (no AI interpretation/summaries)
    const leftArticle = pickByBias(realArticles, 'left');
    const centerArticle = pickByBias(realArticles, 'center');
    const rightArticle = pickByBias(realArticles, 'right');

    const perspectives = [
      {
        perspective: 'left',
        label: 'Left-Leaning Source',
        outlet: leftArticle?.outlet || 'No left-leaning sources found',
        headline: leftArticle?.title || 'No article found',
        summary: leftArticle?.snippet || 'No summary available from this outlet for this topic.',
        timeAgo: 'Recently',
        articleUrl: leftArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'center',
        label: 'Center Source',
        outlet: centerArticle?.outlet || 'No center sources found',
        headline: centerArticle?.title || 'No article found',
        summary: centerArticle?.snippet || 'No summary available from this outlet for this topic.',
        timeAgo: 'Recently',
        articleUrl: centerArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'right',
        label: 'Right-Leaning Source',
        outlet: rightArticle?.outlet || 'No right-leaning sources found',
        headline: rightArticle?.title || 'No article found',
        summary: rightArticle?.snippet || 'No summary available from this outlet for this topic.',
        timeAgo: 'Recently',
        articleUrl: rightArticle?.url || '',
        factChecks: [],
      },
    ];

    // Use AI just for topic metadata (title/description/tags)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON with no markdown. Provide a short title, one-sentence description, and 3 tags for the given topic. Example: {"title":"...","description":"...","tags":["...","...","..."]}'
          },
          { role: 'user', content: `Generate a short title, one-sentence description, and 3 tags for this topic: "${topic}"` }
        ],
        temperature: 0.2,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'topic_metadata',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 }
              },
              required: ['title', 'description', 'tags']
            }
          }
        }
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
      topic: {
        ...topicMetadata,
        date: currentDate
      },
      perspectives
    };

    // Search for fact-checks for EACH article's specific content
    // Uses Google Fact Check API to find real fact-checks from Snopes, PolitiFact, etc.
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    
    if (factCheckApiKey && parsedContent?.perspectives?.length > 0) {
      console.log('Searching fact-checks for each article...');
      
      // Process each perspective in parallel
      await Promise.all(parsedContent.perspectives.map(async (perspective: any) => {
        perspective.factChecks = []; // Initialize empty array
        
        if (!perspective.headline && !perspective.summary) return;
        
        try {
          // Search using headline first
          const queries = [perspective.headline];
          
          // Add first sentence of summary as secondary query
          if (perspective.summary) {
            const firstSentence = perspective.summary.split(/[.!?]/)[0]?.trim();
            if (firstSentence && firstSentence.length > 20 && firstSentence !== perspective.headline) {
              queries.push(firstSentence);
            }
          }
          
          const seenUrls = new Set<string>();
          
          for (const query of queries) {
            const encodedQuery = encodeURIComponent(query.slice(0, 150));
            const fcResponse = await fetch(
              `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
              { method: 'GET' }
            );
            
            if (!fcResponse.ok) continue;
            
            const fcData = await fcResponse.json();
            const claims = fcData.claims || [];
            
            for (const claim of claims) {
              const review = claim.claimReview?.[0];
              if (!review || !review.url) continue;
              
              // Deduplicate by URL
              if (seenUrls.has(review.url)) continue;
              seenUrls.add(review.url);
              
              const rating = (review.textualRating || '').toLowerCase();
              let status = 'disputed';
              if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate')) {
                status = 'verified';
              } else if (rating.includes('false') || rating.includes('wrong') || rating.includes('pants on fire')) {
                status = 'false';
              } else if (rating.includes('mixed') || rating.includes('partly') || rating.includes('misleading')) {
                status = 'disputed';
              }
              
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
          }
          
          // Limit to 3 fact-checks per article
          perspective.factChecks = perspective.factChecks.slice(0, 3);
          console.log(`${perspective.perspective} article: ${perspective.factChecks.length} fact-checks found`);
          
        } catch (fcError) {
          console.error(`Fact-check error for ${perspective.perspective}:`, fcError);
        }
      }));
    } else if (!factCheckApiKey) {
      console.log('Google Fact Check API key not configured');
      // Initialize empty factChecks arrays
      parsedContent.perspectives?.forEach((p: any) => { p.factChecks = []; });
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
