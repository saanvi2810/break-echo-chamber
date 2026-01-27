import { Layers, Info } from "lucide-react";

const Header = () => {
  return (
    <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight">
              Echo Chamber Breaker
            </h1>
            <p className="text-xs text-muted-foreground font-sans">
              See every side of the story
            </p>
          </div>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-sm font-medium">
          <Info className="w-4 h-4" />
          <span className="hidden sm:inline">How it works</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
