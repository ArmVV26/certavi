import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import styles from './TextField.module.css';

interface FieldFrameProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  id?: string | undefined;
  /** Renders the control with the ids and ARIA attributes it needs. */
  children: (control: {
    id: string;
    className: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  }) => ReactNode;
  multiline?: boolean;
}

function FieldFrame({ label, hint, error, id, children, multiline = false }: FieldFrameProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {children({
        id: inputId,
        className: cx(styles.input, multiline && styles.multiline, error && styles.invalid),
        'aria-invalid': error ? true : undefined,
        'aria-describedby': cx(hint && hintId, error && errorId) || undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'className'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/** Text, date or time input with its label, an optional hint and an error message. */
export function TextField({ label, hint, error, id, type = 'text', ...rest }: TextFieldProps) {
  return (
    <FieldFrame label={label} hint={hint} error={error} id={id}>
      {(control) => <input {...rest} {...control} type={type} />}
    </FieldFrame>
  );
}

interface TextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'id' | 'className'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/** Multi-line text (notes) with its label, hint and error. */
export function TextArea({ label, hint, error, id, rows = 3, ...rest }: TextAreaProps) {
  return (
    <FieldFrame label={label} hint={hint} error={error} id={id} multiline>
      {(control) => <textarea {...rest} {...control} rows={rows} />}
    </FieldFrame>
  );
}
