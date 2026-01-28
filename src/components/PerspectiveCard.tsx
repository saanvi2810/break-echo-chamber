import { ExternalLink, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { Article, FactCheck } from "@/lib/api/perspectives";

interface PerspectiveCardProps {
  perspective: "left" | "center" | "right";
  label: string;
  articles: Article[];
  animationDelay?: string;
}

const PerspectiveCard = ({
  perspective,
  label,
  articles,
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
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'false':
        return <XCircle className="w-3 h-3 text-red-600" />;
      default:
        return <AlertTriangle className="w-3 h-3 text-amber-600" />;
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
    <div
      className={`bg-card rounded-lg shadow-card ${styles.border} ${styles.hover} transition-all duration-300 overflow-hidden opacity-0 animate-fade-in`}
      style={{ animationDelay }}
    >
      {/* Perspective Header */}
      <div className="p-4 border-b border-border">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles.badge}`}>
          {label}
        </span>
        <p className="text-xs text-muted-foreground mt-2">
          {articles.length} article{articles.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Articles List */}
      <div className="divide-y divide-border">
        {articles.map((article, index) => (
          <article key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {article.outlet}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{article.timeAgo}</span>
              </div>
            </div>

            <h3 className="font-serif text-base font-semibold leading-tight mb-2 line-clamp-2">
              {article.headline}
            </h3>

            <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
              {article.summary}
            </p>

            {/* Fact-checks for this article */}
            {article.factChecks && article.factChecks.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {article.factChecks.map((fc, fcIndex) => (
                  <a
                    key={fcIndex}
                    href={fc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-2 rounded border text-xs ${getStatusColor(fc.status)} hover:opacity-80 transition-opacity`}
                  >
                    <div className="flex items-start gap-1.5">
                      {getStatusIcon(fc.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-1">{fc.title || fc.claimText}</p>
                        <p className="text-[10px] opacity-75">{fc.source}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <a
              href={article.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <span>Read article</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </article>
        ))}

        {articles.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No articles found from this perspective
          </div>
        )}
      </div>
    </div>
  );
};

export default PerspectiveCard;
