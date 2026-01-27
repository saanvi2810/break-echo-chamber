const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FactCheckResult {
  text: string;
  claimant?: string;
  claimDate?: string;
  reviews: {
    publisher: string;
    url: string;
    title: string;
    rating: string;
    reviewDate?: string;
  }[];
}

interface ClaimVerification {
  originalClaim: string;
  verified: boolean;
  status: 'verified' | 'disputed' | 'false' | 'unverified';
  factChecks: FactCheckResult[];
  source?: string;
  sourceUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { claims } = await req.json();

    if (!claims || !Array.isArray(claims)) {
      return new Response(
        JSON.stringify({ error: 'Claims array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    if (!apiKey) {
      console.log('Google Fact Check API key not configured, returning unverified status');
      // Return claims as unverified if no API key
      const results: ClaimVerification[] = claims.map((claim: string) => ({
        originalClaim: claim,
        verified: false,
        status: 'unverified' as const,
        factChecks: [],
      }));
      return new Response(
        JSON.stringify({ success: true, data: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fact-checking ${claims.length} claims`);

    const results: ClaimVerification[] = await Promise.all(
      claims.map(async (claim: string): Promise<ClaimVerification> => {
        try {
          // Extract key terms from the claim for better search
          const searchQuery = encodeURIComponent(claim.slice(0, 200));
          
          const response = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${searchQuery}&key=${apiKey}&languageCode=en`,
            { method: 'GET' }
          );

          if (!response.ok) {
            console.error(`Fact check API error for claim: ${claim}`, await response.text());
            return {
              originalClaim: claim,
              verified: false,
              status: 'unverified',
              factChecks: [],
            };
          }

          const data = await response.json();
          
          if (!data.claims || data.claims.length === 0) {
            return {
              originalClaim: claim,
              verified: false,
              status: 'unverified',
              factChecks: [],
            };
          }

          // Process fact-check results
          const factChecks: FactCheckResult[] = data.claims.slice(0, 3).map((fc: any) => ({
            text: fc.text || '',
            claimant: fc.claimant,
            claimDate: fc.claimDate,
            reviews: (fc.claimReview || []).map((review: any) => ({
              publisher: review.publisher?.name || 'Unknown',
              url: review.url || '',
              title: review.title || '',
              rating: review.textualRating || 'Unknown',
              reviewDate: review.reviewDate,
            })),
          }));

          // Determine overall status based on fact-check ratings
          let status: 'verified' | 'disputed' | 'false' | 'unverified' = 'unverified';
          
          if (factChecks.length > 0) {
            const ratings = factChecks.flatMap(fc => 
              fc.reviews.map(r => r.rating.toLowerCase())
            );
            
            const hasTrue = ratings.some(r => 
              r.includes('true') || r.includes('correct') || r.includes('accurate') || r.includes('verdadeiro')
            );
            const hasFalse = ratings.some(r => 
              r.includes('false') || r.includes('wrong') || r.includes('incorrect') || r.includes('pants on fire') || r.includes('falso')
            );
            const hasMixed = ratings.some(r => 
              r.includes('mixed') || r.includes('partly') || r.includes('half') || r.includes('misleading') || r.includes('mostly')
            );

            if (hasFalse && !hasTrue) {
              status = 'false';
            } else if (hasTrue && !hasFalse && !hasMixed) {
              status = 'verified';
            } else if (hasMixed || (hasTrue && hasFalse)) {
              status = 'disputed';
            }
          }

          const firstReview = factChecks[0]?.reviews[0];

          return {
            originalClaim: claim,
            verified: status === 'verified',
            status,
            factChecks,
            source: firstReview?.publisher,
            sourceUrl: firstReview?.url,
          };
        } catch (error) {
          console.error(`Error fact-checking claim: ${claim}`, error);
          return {
            originalClaim: claim,
            verified: false,
            status: 'unverified',
            factChecks: [],
          };
        }
      })
    );

    console.log('Fact-check complete');

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in fact-check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
