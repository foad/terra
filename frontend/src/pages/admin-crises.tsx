import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CrisisRegionEditor } from "../components/crisis-region-editor";
import { api } from "../utils/api";
import styles from "./admin-crises.module.css";

interface CrisisEvent {
  id: string;
  name: string;
  crisis_type: string;
  region: GeoJSON.Polygon;
  is_active: boolean;
}

const CRISIS_TYPES = [
  "Earthquake",
  "Flood",
  "Tsunami",
  "Hurricane/Cyclone",
  "Wildfire",
  "Explosion",
  "Chemical incident",
  "Conflict",
  "Civil unrest",
];

const AdminCrisesPage = () => {
  const [crises, setCrises] = useState<CrisisEvent[]>([]);
  const [editing, setEditing] = useState<CrisisEvent | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api("/crisis-events");
      setCrises(data.events ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (event: CrisisEvent) => {
    if (!confirm(`Delete "${event.name}"?`)) return;
    await api(`/crisis-events/${event.id}`, { method: "DELETE" });
    await refresh();
  };

  if (editing) {
    return (
      <CrisisForm
        initial={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Crisis events</h1>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setEditing("new")}
        >
          <Plus size={16} /> New crisis
        </button>
      </header>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : crises.length === 0 ? (
        <div className={styles.empty}>No crisis events yet.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {crises.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.crisis_type}</td>
                <td>
                  <span
                    className={`${styles.badge} ${c.is_active ? styles.active : styles.inactive}`}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setEditing(c)}
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => handleDelete(c)}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

interface CrisisFormProps {
  initial: CrisisEvent | null;
  onCancel: () => void;
  onSaved: () => void;
}

const CrisisForm = ({ initial, onCancel, onSaved }: CrisisFormProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [crisisType, setCrisisType] = useState(
    initial?.crisis_type ?? CRISIS_TYPES[0],
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [region, setRegion] = useState<GeoJSON.Polygon | null>(
    initial?.region ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && region !== null && !saving;

  const handleSave = async () => {
    if (!canSave || !region) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        crisis_type: crisisType,
        is_active: isActive,
        region,
      };
      if (initial) {
        await api(`/crisis-events/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await api("/crisis-events", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {initial ? "Edit crisis" : "New crisis"}
        </h1>
      </header>

      <CrisisRegionEditor initial={initial?.region ?? null} onChange={setRegion} />
      <p className={styles.help}>
        {region
          ? "Region set. Drag points to adjust, or delete and redraw."
          : "Click on the map to draw a polygon. Double-click to finish."}
      </p>

      <div className={styles.field}>
        <label htmlFor="crisis-name">Name</label>
        <input
          id="crisis-name"
          type="text"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="crisis-type">Type</label>
        <select
          id="crisis-type"
          value={crisisType}
          onChange={(e) => setCrisisType(e.target.value)}
        >
          {CRISIS_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!canSave}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

export default AdminCrisesPage;
