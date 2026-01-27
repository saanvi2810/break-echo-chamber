import { ExternalLink, Clock, Quote } from "lucide-react";
import { useState } from "react";
import FactCheckOverlay from "./FactCheckOverlay";

interface Claim {
  text: string;
  status: "verified" | "disputed" | "false" | "unverified";
  source: string;
  sourceUrl: string;
  factCheckRating?: string;
  factCheckTitle?: string;
}

interface PerspectiveCardProps {
  perspective: "left" | "center" | "right";
  label: string;
  outlet: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  timeAgo: string;
  claims: Claim[];
  articleUrl: string;
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
  claims,
  articleUrl,
  animationDelay = "0s",
}: PerspectiveCardProps) => {
  const [showFactCheck, setShowFactCheck] = useState(false);

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

  return (
    <article
      className={`relative bg-card rounded-lg shadow-card ${styles.border} ${styles.hover} transition-all duration-300 overflow-hidden opacity-0 animate-fade-in`}
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

      <div className="p-5">
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

        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
          {summary}
        </p>

        {claims.length > 0 && (
          <button
            onClick={() => setShowFactCheck(!showFactCheck)}
            className="flex items-center gap-2 text-xs font-medium text-fact-verified hover:underline mb-4 transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
            <span>{claims.length} claims fact-checked</span>
          </button>
        )}

        {showFactCheck && <FactCheckOverlay claims={claims} />}

        <a
          href={articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <span>Read full article</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};

export default PerspectiveCard;
