import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../i18n";
import styles from "./language-switcher.module.css";

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ??
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Globe size={14} />
        <span className={styles.code}>{currentLang.code.toUpperCase()}</span>
      </button>
      {open && (
        <ul className={styles.menu} role="menu">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang.code} role="menuitem">
              <button
                className={`${styles.option} ${lang.code === i18n.language ? styles.active : ""}`}
                lang={lang.code}
                onClick={() => handleSelect(lang.code)}
              >
                <span className={styles.optionCode}>{lang.code.toUpperCase()}</span>
                <span>{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
