import { useState, useRef, useEffect } from "react";
import styles from "./multi-select.module.css";

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    const updated = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(updated);
  };

  const allSelected = selected.length === options.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map((o) => o.value));
  };

  const buttonText =
    selected.length === 0
      ? label
      : `${selected.length} selected`;

  return (
    <div
      className={`${styles.container} ${open ? styles.open : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => setOpen(!open)}
      >
        {buttonText}
      </button>
      {open && (
        <ul
          className={styles.list}
          role="listbox"
          aria-multiselectable="true"
        >
          <li className={styles.toggleAll}>
            <button type="button" className={styles.toggleAllButton} onClick={toggleAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </li>
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={selected.includes(option.value)}>
              <div className="form-check">
                <input
                  type="checkbox"
                  id={`ms-${option.value}`}
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <label htmlFor={`ms-${option.value}`}>{option.label}</label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
