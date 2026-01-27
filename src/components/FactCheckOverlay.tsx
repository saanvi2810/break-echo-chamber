import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";

interface Claim {
  text: string;
  status: "verified" | "disputed" | "false";
  source: string;
  sourceUrl: string;
}

interface FactCheckOverlayProps {
  claims: Claim[];
}

const FactCheckOverlay = ({ claims }: FactCheckOverlayProps) => {
  const statusConfig = {
    verified: {
      icon: CheckCircle2,
      label: "Verified",
      className: "fact-verified border-l-2",
      textClass: "text-fact-verified",
    },
    disputed: {
      icon: AlertTriangle,
      label: "Disputed",
      className: "fact-disputed border-l-2",
      textClass: "text-fact-disputed",
    },
    false: {
      icon: XCircle,
      label: "False",
      className: "fact-false border-l-2",
      textClass: "text-fact-false",
    },
  };

  return (
    <div className="space-y-3 mb-4 animate-scale-in">
      {claims.map((claim, index) => {
        const config = statusConfig[claim.status];
        const Icon = config.icon;

        return (
          <div
            key={index}
            className={`p-3 rounded-md ${config.className} shadow-fact`}
          >
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.textClass}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed text-foreground mb-2">
                  "{claim.text}"
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${config.textClass}`}>
                    {config.label}
                  </span>
                  <a
                    href={claim.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="truncate max-w-[120px]">{claim.source}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FactCheckOverlay;
