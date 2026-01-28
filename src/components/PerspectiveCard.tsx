import { ExternalLink, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { FactCheck } from "@/lib/api/perspectives";

interface PerspectiveCardProps {
  perspective: "left" | "center" | "right";
  label: string;
  outlet: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  timeAgo: string;
  articleUrl: string;
  factChecks?: FactCheck[];
  animationDelay?: string;
}

const PerspectiveCard = ({
  perspective,
  label,
  outlet,
  headline,
  summary,
  imageUrl,
  timeAgo,
  articleUrl,
  factChecks = [],
  animationDelay = "0s",
}: PerspectiveCardProps) => {
  const perspectiveStyles = {
    left: {
      border: "border-l-4 border-perspective-left",
      badge: "bg-perspective-left-bg text-perspective-left",
      hover: "hover:shadow-card-hover",
    },
    center: {
      border: "border-l-4 border-perspective-center",
      badge: "bg-perspective-center-bg text-perspective-center",
      hover: "hover:shadow-card-hover",
    },
    right: {
      border: "border-l-4 border-perspective-right",
      badge: "bg-perspective-right-bg text-perspective-right",
      hover: "hover:shadow-card-hover",
    },
  };

  const styles = perspectiveStyles[perspective];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
      case 'false':
        return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'false':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-800';
    }
  };

  return (
    <article
      className={`relative bg-card rounded-lg shadow-card ${styles.border} ${styles.hover} transition-all duration-300 overflow-hidden opacity-0 animate-fade-in flex flex-col`}
      style={{ animationDelay }}
    >
      {imageUrl && (
        <div className="aspect-video overflow-hidden">
          <img
            src={imageUrl}
            alt={headline}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles.badge}`}>
            {label}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          {outlet}
        </p>

        <h3 className="font-serif text-lg font-semibold leading-tight mb-3 line-clamp-3">
          {headline}
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-4 flex-1">
          {summary}
        </p>

        {/* Fact-checks for this article */}
        {factChecks.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Related Fact-Checks
            </p>
            {factChecks.map((fc, index) => (
              <a
                key={index}
                href={fc.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block p-2 rounded border text-xs ${getStatusColor(fc.status)} hover:opacity-80 transition-opacity`}
              >
                <div className="flex items-start gap-2">
                  {getStatusIcon(fc.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-2">{fc.title || fc.claimText}</p>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      {fc.source} • {fc.rating}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {articleUrl && articleUrl.startsWith("http") ? (
          <a
            href={articleUrl}
            target="_top"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mt-auto"
          >
            <span>Read full article</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground mt-auto">
            No valid article link found for this source.
          </p>
        )}
      </div>
    </article>
  );
};

export default PerspectiveCard;
