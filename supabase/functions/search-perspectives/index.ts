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

async function searchNews(topic: string, perplexityKey: string): Promise<NewsArticle[]> {
  console.log('Searching news with Perplexity for:', topic);
  
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
          role: 'system',
          content: 'You are a news search assistant. Find recent news articles about the given topic from diverse sources across the political spectrum. Return ONLY a JSON array of articles with url, title, and outlet fields. No other text.'
        },
        {
          role: 'user',
          content: `Find 6-9 recent news articles about: "${topic}". Include sources from left-leaning (MSNBC, Guardian, HuffPost), center (Reuters, AP, BBC), and right-leaning (Fox News, WSJ, Daily Wire) outlets. Return as JSON array: [{"url": "...", "title": "...", "outlet": "..."}]`
        }
      ],
      search_recency_filter: 'week',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity search error:', errorText);
    throw new Error('Failed to search news');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  console.log('Perplexity response received, citations:', citations.length);
  
  // Parse the JSON response from Perplexity
  let articles: NewsArticle[] = [];
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      articles = parsed.map((item: any) => ({
        url: item.url,
        title: item.title,
        outlet: item.outlet || detectOutletFromUrl(item.url),
        snippet: item.snippet || '',
        bias: detectBias(item.outlet || '', item.url),
      }));
    }
  } catch (e) {
    console.log('Failed to parse Perplexity JSON, using citations instead');
  }
  
  // If we couldn't parse JSON, use citations directly
  if (articles.length === 0 && citations.length > 0) {
    articles = citations.slice(0, 9).map((url: string) => {
      const outlet = detectOutletFromUrl(url);
      return {
        url,
        title: `Article from ${outlet}`,
        outlet,
        snippet: '',
        bias: detectBias(outlet, url),
      };
    });
  }
  
  return articles;
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

    // Build article context for the AI
    const articleContext = realArticles.length > 0 
      ? `\n\nREAL ARTICLES FOUND (use these exact URLs and headlines):\n${realArticles.map(a => 
          `- [${a.bias?.toUpperCase() || 'UNKNOWN'}] ${a.outlet}: "${a.title}" - ${a.url}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are a news analyst that provides balanced, multi-perspective coverage of current events. 
For any topic, you must provide exactly 3 perspectives: progressive/left-leaning, centrist/balanced, and conservative/right-leaning.

TODAY'S DATE IS: ${currentDate}
${articleContext}

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.
${realArticles.length > 0 ? 'CRITICAL: Use the REAL ARTICLE URLs provided above. Match each perspective to actual articles from matching outlets.' : ''}

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
      "claims": [
        {
          "text": "A specific factual claim from the article",
          "status": "verified OR disputed OR false",
          "source": "Fact-check source",
          "sourceUrl": "https://example.com"
        }
      ],
      "articleUrl": "The real URL from the articles above"
    },
    {
      "perspective": "center",
      "label": "Balanced Analysis",
      "outlet": "Name of the actual outlet",
      "headline": "The actual headline from the article",
      "summary": "2-3 sentence summary based on the actual article content",
      "timeAgo": "Recently",
      "claims": [...],
      "articleUrl": "The real URL from the articles above"
    },
    {
      "perspective": "right",
      "label": "Conservative View", 
      "outlet": "Name of the actual outlet",
      "headline": "The actual headline from the article",
      "summary": "2-3 sentence summary based on the actual article content",
      "timeAgo": "Recently",
      "claims": [...],
      "articleUrl": "The real URL from the articles above"
    }
  ]
}

Include 1-2 fact-checkable claims per perspective with realistic verification status.`;

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

    // Extract all claims from perspectives for fact-checking
    const allClaims: string[] = [];
    const claimMap: Map<string, { perspectiveIndex: number; claimIndex: number }> = new Map();
    
    if (parsedContent.perspectives) {
      parsedContent.perspectives.forEach((perspective: any, pIndex: number) => {
        if (perspective.claims && Array.isArray(perspective.claims)) {
          perspective.claims.forEach((claim: any, cIndex: number) => {
            if (claim.text) {
              allClaims.push(claim.text);
              claimMap.set(claim.text, { perspectiveIndex: pIndex, claimIndex: cIndex });
            }
          });
        }
      });
    }

    // Fact-check claims using Google Fact Check API
    if (allClaims.length > 0) {
      console.log(`Fact-checking ${allClaims.length} claims`);
      
      const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
      
      if (factCheckApiKey) {
        try {
          const factCheckResults = await Promise.all(
            allClaims.map(async (claimText: string) => {
              try {
                const searchQuery = encodeURIComponent(claimText.slice(0, 200));
                const fcResponse = await fetch(
                  `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${searchQuery}&key=${factCheckApiKey}&languageCode=en`,
                  { method: 'GET' }
                );
                
                if (!fcResponse.ok) {
                  return { claimText, factChecks: [] };
                }
                
                const fcData = await fcResponse.json();
                return { claimText, factChecks: fcData.claims || [] };
              } catch {
                return { claimText, factChecks: [] };
              }
            })
          );

          // Update claims with real fact-check data
          factCheckResults.forEach(({ claimText, factChecks }) => {
            const location = claimMap.get(claimText);
            if (location && factChecks.length > 0) {
              const claim = parsedContent.perspectives[location.perspectiveIndex].claims[location.claimIndex];
              const firstCheck = factChecks[0];
              const firstReview = firstCheck.claimReview?.[0];
              
              if (firstReview) {
                const rating = (firstReview.textualRating || '').toLowerCase();
                let status = 'disputed';
                
                if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate')) {
                  status = 'verified';
                } else if (rating.includes('false') || rating.includes('wrong') || rating.includes('pants on fire')) {
                  status = 'false';
                } else if (rating.includes('mixed') || rating.includes('partly') || rating.includes('misleading')) {
                  status = 'disputed';
                }
                
                claim.status = status;
                claim.source = firstReview.publisher?.name || claim.source;
                claim.sourceUrl = firstReview.url || claim.sourceUrl;
                claim.factCheckRating = firstReview.textualRating;
                claim.factCheckTitle = firstReview.title;
              }
            }
          });

          console.log('Fact-checking complete');
        } catch (fcError) {
          console.error('Fact-check error:', fcError);
        }
      } else {
        console.log('Google Fact Check API key not configured, skipping verification');
      }
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
