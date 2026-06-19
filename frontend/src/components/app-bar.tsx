import { Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { NavLink, useNavigate } from "react-router";
import styles from "./app-bar.module.css";

export const AppBar = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const email =
    (auth.user?.profile?.email as string | undefined) ??
    (auth.user?.profile?.["cognito:username"] as string | undefined) ??
    null;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`;

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <Menu size={20} />
        </button>
        <h1 className={styles.title}>TERRA</h1>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          <NavLink to="/dashboard" className={navClass} onClick={closeMenu}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/crises" className={navClass} onClick={closeMenu}>
            Crisis Management
          </NavLink>
        </nav>
        {email && (
          <span className={styles.userArea}>
            <span className={styles.email}>{email}</span>
            <button
              type="button"
              className={styles.signOut}
              onClick={() => navigate("/logout")}
            >
              Sign out
            </button>
          </span>
        )}
      </div>
      {menuOpen && (
        <div
          className={styles.menuBackdrop}
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
    </header>
  );
};
