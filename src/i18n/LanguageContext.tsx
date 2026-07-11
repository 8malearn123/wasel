import React, { createContext, useContext, useState, useEffect, useRef, Fragment, ReactNode } from "react";
import { en, TranslationKeys } from "./translations/en";
import { ar } from "./translations/ar";
import { startAutoTranslate, stopAutoTranslate } from "./autoTranslate";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, TranslationKeys> = { en, ar };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return (saved === "ar" || saved === "en") ? saved : "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const isRTL = language === "ar";

  // Most pages hardcode Arabic text; a DOM-level translator swaps it to English.
  // Switching back to Arabic remounts the tree (generation bump) to restore originals.
  const [generation, setGeneration] = useState(0);
  const prevLanguage = useRef(language);

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("rtl", isRTL);

    if (prevLanguage.current === "en" && language === "ar") {
      stopAutoTranslate();
      setGeneration((g) => g + 1);
    }
    prevLanguage.current = language;

    if (language === "en") {
      startAutoTranslate();
    } else {
      stopAutoTranslate();
    }
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language], isRTL }}>
      <Fragment key={generation}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
