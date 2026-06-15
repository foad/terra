import { useAuth } from "react-oidc-context";
import { NavLink, useNavigate } from "react-router";
import styles from "./app-bar.module.css";

export const AppBar = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const email =
    (auth.user?.profile?.email as string | undefined) ??
    (auth.user?.profile?.["cognito:username"] as string | undefined) ??
    null;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`;

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <h1 className={styles.title}>TERRA</h1>
        <nav className={styles.nav}>
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/crises" className={navClass}>
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
    </header>
  );
};
