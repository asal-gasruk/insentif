"use client";

import dynamic from "next/dynamic";
import type { GroupBase, Props as ReactSelectProps, StylesConfig } from "react-select";

export type Select2Option = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

const ReactSelect = dynamic<
  ReactSelectProps<Select2Option, false, GroupBase<Select2Option>>
>(() => import("react-select"), {
  ssr: false,
  loading: () => (
    <div
      className="input flex min-h-10 items-center px-3 text-sm text-[var(--text-muted)]"
      aria-hidden
    >
      Memuat...
    </div>
  ),
});

type Select2Props = {
  value: string;
  onChange: (value: string) => void;
  options: Select2Option[];
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  className?: string;
  /** compact = untuk baris form padat / modal kecil */
  size?: "default" | "compact";
  id?: string;
};

const baseStyles: StylesConfig<Select2Option, false, GroupBase<Select2Option>> = {
  control: (base, state) => ({
    ...base,
    minHeight: "2.5rem",
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "var(--action)" : "var(--border)",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(250, 195, 0, 0.35)" : "none",
    backgroundColor: state.isDisabled ? "var(--surface-muted)" : "white",
    fontSize: "0.875rem",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    "&:hover": {
      borderColor: state.isFocused ? "var(--action)" : "var(--border)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 0.75rem",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: "var(--text)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--text)",
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--text-muted)",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.5rem",
    border: "1px solid var(--border)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    overflow: "hidden",
    zIndex: 9999,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isSelected
      ? "var(--action)"
      : state.isFocused
        ? "var(--surface-muted)"
        : "white",
    color: state.isSelected ? "var(--on-action)" : "var(--text)",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--text-muted)",
    padding: "0 0.5rem",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "var(--text-muted)",
    padding: "0 0.25rem",
  }),
};

const compactStyles: StylesConfig<Select2Option, false, GroupBase<Select2Option>> = {
  ...baseStyles,
  control: (base, state) => ({
    ...(typeof baseStyles.control === "function"
      ? baseStyles.control(base, state)
      : base),
    minHeight: "2rem",
    fontSize: "0.8125rem",
  }),
};

export function Select2({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  isDisabled = false,
  isClearable = false,
  isSearchable = true,
  className = "",
  size = "default",
  id,
}: Select2Props) {
  const selected =
    options.find((o) => o.value === value) ??
    (value ? { value, label: value } : null);

  const styles = size === "compact" ? compactStyles : baseStyles;

  return (
    <div className={className}>
      <ReactSelect
        inputId={id}
        instanceId={id}
        value={selected}
        onChange={(opt) => onChange(opt?.value ?? "")}
        options={options}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        isSearchable={isSearchable}
        styles={styles}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : undefined
        }
        menuPosition="fixed"
        noOptionsMessage={() => "Tidak ada pilihan"}
        classNamePrefix="select2"
      />
    </div>
  );
}

/** Helper: map array ke options Select2 */
export function toSelectOptions(
  items: { value: string; label: string }[],
): Select2Option[] {
  return items.map((i) => ({ value: i.value, label: i.label }));
}
