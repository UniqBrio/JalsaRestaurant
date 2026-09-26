'use client';

import * as React from 'react';
import { Button } from './button';
import { imageProblem } from '@/lib/media';

/**
 * Choose a PNG or JPEG of 1 MB or less, see it, replace it, remove it (items 23 and 32).
 *
 * The file is checked HERE first - its own bytes, not its name - so a wrong file is refused with
 * the reason before anything is sent; the server checks the same bytes again with the same
 * function (`lib/media.ts`), because a phone's word is not a check. `upload` resolves to the URL
 * the app serves the stored file at.
 */
export function ImagePicker({
  value,
  onChange,
  upload,
  testId,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (url: string) => void;
  upload: (base64: string) => Promise<string>;
  testId: string;
  label: string;
  disabled?: boolean;
}) {
  const [problem, setProblem] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined): Promise<void> => {
    setProblem(null);
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const why = imageProblem(bytes);
    if (why) {
      setProblem(why);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      onChange(await upload(btoa(binary)));
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'That image could not be saved. Try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a stored upload of unknown size, served by our own route
          <img
            src={value}
            alt={label}
            data-testid={`${testId}-preview`}
            className="h-16 w-16 rounded-[var(--radius-md)] object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-sunken)] type-caption text-[var(--text-muted)]">
            No image
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label={label}
          data-testid={`${testId}-file`}
          disabled={disabled || busy}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <Button
          data-testid={`${testId}-choose`}
          size="sm"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Choose image'}
        </Button>
        {value ? (
          <Button
            data-testid={`${testId}-remove`}
            size="sm"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => onChange('')}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <p className="m-0 type-caption text-[var(--text-muted)]">PNG or JPEG, 1 MB at most.</p>
      {problem ? (
        <p
          role="alert"
          data-testid={`${testId}-problem`}
          className="m-0 type-caption font-semibold text-[var(--error)]"
        >
          {problem}
        </p>
      ) : null}
    </div>
  );
}
