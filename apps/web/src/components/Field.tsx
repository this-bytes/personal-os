import type { ReactNode } from 'react';
import { Label } from '@personal-os/ui';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

/** A labelled form control with an optional hint line. */
export function Field({ label, hint, htmlFor, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <Label htmlFor={htmlFor} className="pos-field-label">
        {label}
      </Label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}
