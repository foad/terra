import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X, QrCode } from "lucide-react";
import { CrisisRegionEditor } from "../components/crisis-region-editor";
import { ActivationKitModal } from "../components/activation-kit-modal";
import { api } from "../utils/api";
import type { FollowUpQuestion } from "../utils/report-queue";
import styles from "./admin-crises.module.css";

interface CrisisEvent {
  id: string;
  name: string;
  crisis_type: string;
  region: GeoJSON.Polygon;
  is_active: boolean;
  follow_up_questions: FollowUpQuestion[];
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

const MAX_QUESTIONS = 3;

const SUGGESTED_QUESTIONS: Record<string, Omit<FollowUpQuestion, "id">[]> = {
  Earthquake: [
    { question: "Are roads and access routes passable in this area?", options: ["Fully passable", "Partially blocked", "Fully blocked", "Unknown"], allow_other: false },
    { question: "Is clean water currently available?", options: ["Yes, fully available", "Limited availability", "Not available", "Unknown"], allow_other: false },
    { question: "What is the current market activity in this area?", options: ["Fully open", "Partially open", "Mostly closed", "Closed", "Unknown"], allow_other: false },
  ],
  Flood: [
    { question: "What is the current flood water level at this location?", options: ["Receding", "Stable", "Rising", "Area already dry", "Unknown"], allow_other: false },
    { question: "Are people able to return to their homes?", options: ["Yes", "Partially", "No — unsafe", "Unknown"], allow_other: false },
    { question: "What is the current market activity in this area?", options: ["Fully open", "Partially open", "Mostly closed", "Closed", "Unknown"], allow_other: false },
  ],
  Wildfire: [
    { question: "Is this area accessible for emergency services?", options: ["Fully accessible", "Partially accessible", "Not accessible", "Unknown"], allow_other: false },
    { question: "What is the current air quality?", options: ["Good", "Moderate", "Poor", "Hazardous", "Unknown"], allow_other: false },
  ],
  Conflict: [
    { question: "Is movement in this area currently safe?", options: ["Yes, safe", "Use caution", "Not safe", "Unknown"], allow_other: false },
    { question: "Are markets and essential services operating?", options: ["Fully operating", "Partially operating", "Closed", "Unknown"], allow_other: false },
  ],
  _default: [
    { question: "What is the current market activity in this area?", options: ["Fully open", "Partially open", "Mostly closed", "Closed", "Unknown"], allow_other: false },
    { question: "What does the community most urgently need?", options: ["Food and water", "Medical assistance", "Shelter", "Electricity restoration", "Transportation"], allow_other: true },
    { question: "Are community services functioning?", options: ["Fully functioning", "Partially functioning", "Not functioning", "Unknown"], allow_other: false },
  ],
};

function getSuggestions(crisisType: string): Omit<FollowUpQuestion, "id">[] {
  return SUGGESTED_QUESTIONS[crisisType] ?? SUGGESTED_QUESTIONS["_default"];
}

const AdminCrisesPage = () => {
  const [crises, setCrises] = useState<CrisisEvent[]>([]);
  const [editing, setEditing] = useState<CrisisEvent | "new" | null>(null);
  const [kitCrisis, setKitCrisis] = useState<CrisisEvent | null>(null);
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
    <>
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
                    onClick={() => setKitCrisis(c)}
                    aria-label="Activation Kit"
                    title="Community Activation Kit"
                  >
                    <QrCode size={16} />
                  </button>
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

    {kitCrisis && (
      <ActivationKitModal
        name={kitCrisis.name}
        crisisType={kitCrisis.crisis_type}
        onClose={() => setKitCrisis(null)}
      />
    )}
    </>
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
  const [questions, setQuestions] = useState<FollowUpQuestion[]>(
    initial?.follow_up_questions ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && region !== null && !saving;
  const suggestions = getSuggestions(crisisType);
  const addedIds = new Set(questions.map((q) => q.question));

  const addSuggestion = (suggestion: Omit<FollowUpQuestion, "id">) => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [
      ...prev,
      { ...suggestion, id: crypto.randomUUID() },
    ]);
  };

  const addBlankQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), question: "", options: ["", ""], allow_other: false },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, patch: Partial<FollowUpQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const addOption = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  };

  const updateOption = (qId: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      }),
    );
  };

  const removeOption = (qId: string, index: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const options = q.options.filter((_, i) => i !== index);
        return { ...q, options };
      }),
    );
  };

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
        follow_up_questions: questions.map((q) => ({
          ...q,
          options: q.options.filter((o) => o.trim()),
        })).filter((q) => q.question.trim() && q.options.length >= 2),
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

      <div className={styles.followUpSection}>
        <h2 className={styles.followUpTitle}>
          Follow-up questions
          <span className={styles.followUpCount}>
            {questions.length}/{MAX_QUESTIONS}
          </span>
        </h2>
        <p className={styles.followUpHelp}>
          Optional questions shown to users after they submit a report. Max {MAX_QUESTIONS}.
        </p>

        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <p className={styles.suggestionsLabel}>Suggested for {crisisType}:</p>
            <div className={styles.suggestionChips}>
              {suggestions.map((s) => {
                const alreadyAdded = addedIds.has(s.question);
                return (
                  <button
                    key={s.question}
                    type="button"
                    className={`${styles.suggestionChip} ${alreadyAdded || questions.length >= MAX_QUESTIONS ? styles.chipDisabled : ""}`}
                    onClick={() => !alreadyAdded && addSuggestion(s)}
                    disabled={alreadyAdded || questions.length >= MAX_QUESTIONS}
                  >
                    <Plus size={12} /> {s.question}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {questions.map((q, qi) => (
          <div key={q.id} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>Q{qi + 1}</span>
              <button
                type="button"
                className={styles.removeQuestion}
                onClick={() => removeQuestion(q.id)}
                aria-label="Remove question"
              >
                <X size={14} />
              </button>
            </div>
            <div className={styles.field}>
              <label>Question</label>
              <input
                type="text"
                value={q.question}
                maxLength={500}
                placeholder="e.g. Are roads passable in this area?"
                onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label>Answer options</label>
              {q.options.map((opt, oi) => (
                <div key={oi} className={styles.optionRow}>
                  <input
                    type="text"
                    value={opt}
                    maxLength={200}
                    placeholder={`Option ${oi + 1}`}
                    onChange={(e) => updateOption(q.id, oi, e.target.value)}
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      className={styles.removeOption}
                      onClick={() => removeOption(q.id, oi)}
                      aria-label="Remove option"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 8 && (
                <button
                  type="button"
                  className={styles.addOption}
                  onClick={() => addOption(q.id)}
                >
                  <Plus size={12} /> Add option
                </button>
              )}
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={q.allow_other}
                onChange={(e) => updateQuestion(q.id, { allow_other: e.target.checked })}
              />
              Include "Other — please specify" option
            </label>
          </div>
        ))}

        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            className={styles.addQuestion}
            onClick={addBlankQuestion}
          >
            <Plus size={14} /> Write custom question
          </button>
        )}
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
