import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ScanBarcode, Search, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

interface ScannerSectionProps {
  onScan: (query: string) => void;
  isSearching: boolean;
}

export function ScannerSection({ onScan, isSearching }: ScannerSectionProps) {
  const [scannerInput, setScannerInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    if (isScanning && scannerRef.current) {
      scannerRef.current.focus();
    }
  }, [isScanning]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scannerInput.trim()) {
      onScan(scannerInput.trim());
      setScannerInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4 shadow-md"
    >
      <div className="flex items-center gap-4">
        <form onSubmit={handleScanSubmit} className="flex-1 flex gap-3">
          <div className="relative flex-1">
            <ScanBarcode className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground",
              isRTL ? "right-4" : "left-4"
            )} />
            <Input
              ref={scannerRef}
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              placeholder={t.pos.scanPlaceholder}
              className={cn("h-14 text-lg scanner-input", isRTL ? "pr-12" : "pl-12")}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 px-6 touch-button bg-gradient-primary hover:opacity-90"
            disabled={isSearching}
          >
            <Search className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} />
            {t.pos.quickAdd}
          </Button>
        </form>

        <Button
          variant="outline"
          size="lg"
          className="h-14 px-6 touch-button"
          onClick={() => setIsScanning(!isScanning)}
        >
          <Camera className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} />
          Camera
        </Button>
      </div>

      {isScanning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 p-8 bg-muted/30 rounded-lg border-2 border-dashed border-border text-center"
        >
          <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Camera scanning mode active</p>
          <p className="text-sm text-muted-foreground">Position barcode in front of camera</p>
        </motion.div>
      )}
    </motion.div>
  );
}
