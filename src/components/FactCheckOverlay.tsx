import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, ExternalLink, ShieldCheck } from "lucide-react";

interface Claim {
  text: string;
  status: "verified" | "disputed" | "false" | "unverified";
  source: string;
  sourceUrl: string;
  factCheckRating?: string;
  factCheckTitle?: string;
  isRealFactCheck?: boolean;
}

interface FactCheckOverlayProps {
  claims: Claim[];
}

const FactCheckOverlay = ({ claims }: FactCheckOverlayProps) => {
  const statusConfig = {
    verified: {
      icon: CheckCircle2,
      label: "Verified",
      className: "bg-green-50 dark:bg-green-950/30 border-l-2 border-green-500",
      textClass: "text-green-600 dark:text-green-400",
    },
    disputed: {
      icon: AlertTriangle,
      label: "Disputed",
      className: "bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-yellow-500",
      textClass: "text-yellow-600 dark:text-yellow-400",
    },
    false: {
      icon: XCircle,
      label: "False",
      className: "bg-red-50 dark:bg-red-950/30 border-l-2 border-red-500",
      textClass: "text-red-600 dark:text-red-400",
    },
    unverified: {
      icon: HelpCircle,
      label: "Unverified",
      className: "bg-gray-50 dark:bg-gray-900/30 border-l-2 border-gray-400",
      textClass: "text-gray-500 dark:text-gray-400",
    },
  };

  // Separate real fact-checks from unverified claims
  const realFactChecks = claims.filter(c => c.isRealFactCheck);
  const unverifiedClaims = claims.filter(c => !c.isRealFactCheck);

  return (
    <div className="space-y-3 mb-4 animate-scale-in">
      {realFactChecks.map((claim, index) => {
        const status = claim.status || 'unverified';
        const config = statusConfig[status] || statusConfig.unverified;
        const Icon = config.icon;

        return (
          <div
            key={`real-${index}`}
            className={`p-3 rounded-md ${config.className} shadow-sm`}
          >
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.textClass}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed text-foreground mb-2">
                  "{claim.text}"
                </p>
                
                {claim.factCheckRating && (
                  <p className="text-xs text-muted-foreground mb-2 italic">
                    Rating: {claim.factCheckRating}
                  </p>
                )}
                
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${config.textClass}`}>
                      {config.label}
                    </span>
                    <ShieldCheck className="w-3 h-3 text-primary" />
                  </div>
                  {claim.sourceUrl && claim.sourceUrl.startsWith('http') ? (
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
                    >
                      <span className="truncate max-w-[150px]">{claim.source}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {claim.source}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {unverifiedClaims.map((claim, index) => (
        <div
          key={`unverified-${index}`}
          className="p-3 rounded-md bg-gray-50 dark:bg-gray-900/30 border-l-2 border-gray-300 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-foreground mb-2">
                "{claim.text}"
              </p>
              <span className="text-xs text-gray-500">
                Not yet fact-checked by independent sources
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {realFactChecks.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Fact-checks powered by Google Fact Check Tools API
        </p>
      )}
      
      {realFactChecks.length === 0 && unverifiedClaims.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          No independent fact-checks found for these claims
        </p>
      )}
    </div>
  );
};

export default FactCheckOverlay;
