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

async function searchNewsByBias(
  topic: string,
  perplexityKey: string,
  bias: 'left' | 'center' | 'right'
): Promise<NewsArticle[]> {
  const siteFilters: Record<string, string> = {
    left: 'site:theguardian.com OR site:msnbc.com OR site:huffpost.com OR site:vox.com OR site:slate.com OR site:thedailybeast.com',
    center: 'site:reuters.com OR site:apnews.com OR site:bbc.com OR site:npr.org OR site:axios.com OR site:thehill.com',
    right: 'site:foxnews.com OR site:wsj.com OR site:dailywire.com OR site:nypost.com OR site:washingtonexaminer.com OR site:nationalreview.com',
  };

  const query = `${topic} news ${siteFilters[bias]}`;
  console.log(`Searching ${bias} sources:`, query);

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
          content: `Find the most recent news article about "${topic}" from these sources: ${siteFilters[bias]}. Just tell me what you found.`
        }
      ],
      search_recency_filter: 'week',
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

  // Extract articles from citations (these are real URLs from Perplexity's search)
  const articles: NewsArticle[] = citations
    .filter((url: string) => url && typeof url === 'string' && url.startsWith('http'))
    .map((url: string) => {
      const outlet = detectOutletFromUrl(url);
      // Try to extract title from content if mentioned
      const urlDomain = new URL(url).hostname.replace('www.', '');
      const titleMatch = content.match(new RegExp(`["']([^"']{10,100})["'][^"']*${urlDomain.split('.')[0]}`, 'i'));
      
      return {
        url,
        title: titleMatch?.[1] || `Article from ${outlet}`,
        outlet,
        snippet: '',
        bias: bias,
      };
    });

  return articles;
}

async function searchNews(topic: string, perplexityKey: string): Promise<NewsArticle[]> {
  console.log('Searching news with Perplexity for diverse sources:', topic);

  // Search each bias category in parallel to ensure diverse sources
  const [leftArticles, centerArticles, rightArticles] = await Promise.all([
    searchNewsByBias(topic, perplexityKey, 'left'),
    searchNewsByBias(topic, perplexityKey, 'center'),
    searchNewsByBias(topic, perplexityKey, 'right'),
  ]);

  const allArticles = [...leftArticles, ...centerArticles, ...rightArticles];
  console.log(`Total articles found: ${allArticles.length} (left: ${leftArticles.length}, center: ${centerArticles.length}, right: ${rightArticles.length})`);
  
  return allArticles;
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  const candidates = articles.filter((a) => a.bias === bias);
  return candidates[0] || articles[0];
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
    return realArticles[0];
  };

  parsedContent.perspectives.forEach((p: any) => {
    const chosen = fallbackFor(p);
    if (!chosen) return;

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

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Build strict URL list for the AI (we'll also enforce after parsing)
    const articleContext = realArticles.length > 0
      ? `\n\nREAL ARTICLES (ONLY use these exact URLs):\n${realArticles
          .slice(0, 12)
          .map((a) => `- [${(a.bias || 'center').toUpperCase()}] ${a.outlet}: ${a.title} :: ${a.url}`)
          .join('\n')}`
      : '';

    const systemPrompt = `You are a news analyst that provides balanced, multi-perspective coverage of current events. 
For any topic, you must provide exactly 3 perspectives: progressive/left-leaning, centrist/balanced, and conservative/right-leaning.

TODAY'S DATE IS: ${currentDate}
${articleContext}

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.
${realArticles.length > 0 ? 'CRITICAL: You MUST choose articleUrl ONLY from the REAL ARTICLES list above. Never invent URLs.' : ''}

The JSON must follow this exact structure:
{
  "topic": {
    "title": "Brief topic title",
    "description": "One sentence description of the topic",
    "date": "${currentDate}",
    "tags": ["Tag1", "Tag2", "Tag3"]
  },
  "perspectives": [
    {
      "perspective": "left",
      "label": "Progressive View",
      "outlet": "Name of the actual outlet",
      "headline": "The actual headline from the article",
      "summary": "2-3 sentence summary based on the actual article content",
      "timeAgo": "Recently",
      "articleUrl": "The real URL from the articles above"
    },
    {
      "perspective": "center",
      "label": "Balanced Analysis",
      "outlet": "Name of the actual outlet",
      "headline": "The actual headline from the article",
      "summary": "2-3 sentence summary based on the actual article content",
      "timeAgo": "Recently",
      "articleUrl": "The real URL from the articles above"
    },
    {
      "perspective": "right",
      "label": "Conservative View", 
      "outlet": "Name of the actual outlet",
      "headline": "The actual headline from the article",
      "summary": "2-3 sentence summary based on the actual article content",
      "timeAgo": "Recently",
      "articleUrl": "The real URL from the articles above"
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze the following topic from multiple perspectives: "${topic}". ${realArticles.length > 0 ? 'Use the real articles provided to create accurate summaries with working URLs.' : 'Provide realistic news coverage as it would appear today.'}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze topic' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let parsedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        parsedContent = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce real URLs (prevents hallucinated/fake links)
    enforceRealArticleUrls(parsedContent, realArticles);

    // Search for fact-checks based on actual article content (headlines + summaries)
    // Uses Google Fact Check API to find real fact-checks from Snopes, PolitiFact, etc.
    let articleFactChecks: any[] = [];
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    
    if (factCheckApiKey && parsedContent?.perspectives?.length > 0) {
      try {
        // Build search queries from actual article content
        const searchQueries: string[] = [];
        for (const perspective of parsedContent.perspectives) {
          if (perspective.headline) {
            searchQueries.push(perspective.headline);
          }
          // Also search key phrases from summaries
          if (perspective.summary) {
            // Take first sentence of summary as a search query
            const firstSentence = perspective.summary.split(/[.!?]/)[0]?.trim();
            if (firstSentence && firstSentence.length > 20) {
              searchQueries.push(firstSentence);
            }
          }
        }
        
        console.log(`Searching fact-checks for ${searchQueries.length} article-based queries`);
        
        // Search each query in parallel and deduplicate results
        const factCheckPromises = searchQueries.slice(0, 6).map(async (query) => {
          const encodedQuery = encodeURIComponent(query.slice(0, 150));
          const fcResponse = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
            { method: 'GET' }
          );
          
          if (!fcResponse.ok) {
            console.log(`Fact-check query failed: ${query.slice(0, 50)}...`);
            return [];
          }
          
          const fcData = await fcResponse.json();
          return fcData.claims || [];
        });
        
        const allResults = await Promise.all(factCheckPromises);
        const seenUrls = new Set<string>();
        
        for (const claims of allResults) {
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
            
            articleFactChecks.push({
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
        
        // Limit to top 5 most relevant
        articleFactChecks = articleFactChecks.slice(0, 5);
        console.log(`Found ${articleFactChecks.length} unique article-related fact-checks`);
        
      } catch (fcError) {
        console.error('Fact-check error:', fcError);
      }
    } else if (!factCheckApiKey) {
      console.log('Google Fact Check API key not configured');
    }

    // Add fact-checks to the response
    parsedContent.factChecks = articleFactChecks;

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
