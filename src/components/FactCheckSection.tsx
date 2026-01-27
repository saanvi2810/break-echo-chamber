import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, ShieldCheck } from "lucide-react";
import type { FactCheck } from "@/lib/api/perspectives";

interface FactCheckSectionProps {
  factChecks: FactCheck[];
}

const FactCheckSection = ({ factChecks }: FactCheckSectionProps) => {
  if (!factChecks || factChecks.length === 0) {
    return null;
  }

  const statusConfig = {
    verified: {
      icon: CheckCircle2,
      label: "True",
      className: "bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500",
      textClass: "text-green-600 dark:text-green-400",
    },
    disputed: {
      icon: AlertTriangle,
      label: "Mixed",
      className: "bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-500",
      textClass: "text-yellow-600 dark:text-yellow-400",
    },
    false: {
      icon: XCircle,
      label: "False",
      className: "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500",
      textClass: "text-red-600 dark:text-red-400",
    },
  };

  return (
    <div className="mt-12 animate-fade-in" style={{ animationDelay: "0.5s" }}>
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-serif text-xl font-semibold">
          Related Fact-Checks
        </h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {factChecks.map((check, index) => {
          const config = statusConfig[check.status] || statusConfig.disputed;
          const Icon = config.icon;

          return (
            <div
              key={index}
              className={`p-4 rounded-lg ${config.className} shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.textClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed text-foreground mb-2 line-clamp-3">
                    "{check.claimText}"
                  </p>
                  
                  {check.claimant && check.claimant !== 'Unknown' && (
                    <p className="text-xs text-muted-foreground mb-2">
                      — {check.claimant}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.textClass} bg-white/50 dark:bg-black/20`}>
                      {check.rating || config.label}
                    </span>
                  </div>
                  
                  {check.sourceUrl ? (
                    <a
                      href={check.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
                    >
                      <span>{check.source}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {check.source}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground text-center mt-4">
        Fact-checks from independent organizations via Google Fact Check Tools API
      </p>
    </div>
  );
};

export default FactCheckSection;
