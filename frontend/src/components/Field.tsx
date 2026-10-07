import type { ReactNode } from "react";

/**
 * FormField ชั่วคราว (ui-design-system.md ข้อ 8.1): label มองเห็นได้เสมอ · error ใต้ช่อง + aria-describedby
 */
export default function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label-md text-on-surface">
        {label}
        {required && (
          <span className="text-error" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-label-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-label-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, error?: string | null, hint?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
