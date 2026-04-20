import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language-switcher";
import styles from "./layout.module.css";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>{t("app.title")}</h1>
          <span className={styles.subtitle}>{t("app.subtitle")}</span>
          <LanguageSwitcher />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
};
