import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching perspectives for topic:', topic);

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `You are a news analyst that provides balanced, multi-perspective coverage of current events. 
For any topic, you must provide exactly 3 perspectives: progressive/left-leaning, centrist/balanced, and conservative/right-leaning.

TODAY'S DATE IS: ${currentDate}

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.

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
      "outlet": "Name of a real left-leaning outlet",
      "headline": "A realistic headline from this perspective",
      "summary": "2-3 sentence summary of how this perspective covers the story",
      "timeAgo": "X hours ago",
      "claims": [
        {
          "text": "A specific factual claim made",
          "status": "verified OR disputed OR false",
          "source": "Source that verifies/disputes this",
          "sourceUrl": "https://example.com"
        }
      ],
      "articleUrl": "https://example.com/article"
    },
    {
      "perspective": "center",
      "label": "Balanced Analysis",
      "outlet": "Name of a real centrist outlet",
      "headline": "A realistic headline from this perspective",
      "summary": "2-3 sentence summary of how this perspective covers the story",
      "timeAgo": "X hours ago",
      "claims": [...],
      "articleUrl": "https://example.com/article"
    },
    {
      "perspective": "right",
      "label": "Conservative View", 
      "outlet": "Name of a real right-leaning outlet",
      "headline": "A realistic headline from this perspective",
      "summary": "2-3 sentence summary of how this perspective covers the story",
      "timeAgo": "X hours ago",
      "claims": [...],
      "articleUrl": "https://example.com/article"
    }
  ]
}

Use real outlet names like: The Guardian, MSNBC, HuffPost (left); Reuters, AP News, BBC (center); Fox News, Wall Street Journal Opinion, The Daily Wire (right).
Make the coverage realistic and based on how these outlets typically frame issues.
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
          { role: 'user', content: `Analyze the following topic from multiple perspectives: "${topic}". Provide realistic news coverage as it would appear today.` }
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
      // Try to extract JSON from the response (in case it's wrapped in markdown)
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

    console.log('Successfully analyzed topic');

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
