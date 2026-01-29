import { ArrowDown, Eye, Shield, Sparkles } from "lucide-react";
import VertexSearchWidget from "./VertexSearchWidget";

const Hero = () => {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-perspective-left/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-perspective-center/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-perspective-right/10 rounded-full blur-3xl" />
      </div>
      
      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4 text-perspective-center" />
            <span className="text-sm font-medium">Break free from your filter bubble</span>
          </div>
          
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            One Story,{" "}
            <span className="text-perspective-left">Three</span>{" "}
            <span className="text-perspective-center">Different</span>{" "}
            <span className="text-perspective-right">Lenses</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed animate-fade-in" style={{ animationDelay: "0.2s" }}>
            See how the same news is covered across the political spectrum. 
            Compare perspectives, verify claims, and form your own informed opinion.
          </p>

          {/* Vertex AI Search Widget */}
          <div className="mb-10 animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <VertexSearchWidget />
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 mb-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-perspective-left-bg flex items-center justify-center">
                <Eye className="w-4 h-4 text-perspective-left" />
              </div>
              <span>Multiple Perspectives</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-fact-verified-bg flex items-center justify-center">
                <Shield className="w-4 h-4 text-fact-verified" />
              </div>
              <span>Fact-Check Overlay</span>
            </div>
          </div>
          
          <a 
            href="#trending" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <span>Explore today's topic</span>
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
