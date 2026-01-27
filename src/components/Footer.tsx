import { Layers } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-serif font-semibold">Echo Chamber Breaker</p>
              <p className="text-xs text-muted-foreground">
                Expanding perspectives, one story at a time
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            Built to help you understand multiple perspectives. Sources are curated for balance, not bias.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
