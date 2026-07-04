import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
  features: string[];
}

export function PlaceholderPage({ title, subtitle, icon: Icon, description, features }: PlaceholderPageProps) {
  const { t } = useLanguage();
  
  return (
    <AppLayout title={title} subtitle={subtitle}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16"
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-glow">
          <Icon className="w-12 h-12 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">{description}</p>

        <div className="bg-card rounded-xl border border-border p-6 max-w-lg w-full">
          <h3 className="font-semibold text-foreground mb-4">{t.common.comingFeatures}</h3>
          <ul className="space-y-3">
            {features.map((feature, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">{feature}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <Button className="mt-8 bg-gradient-primary hover:opacity-90">
          {t.common.notifyMe}
        </Button>
      </motion.div>
    </AppLayout>
  );
}
