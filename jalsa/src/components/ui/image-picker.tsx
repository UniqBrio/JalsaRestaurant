'use client';

import * as React from 'react';
import { Button } from './button';
import { cn } from '@/lib/cn';
import { imageProblem } from '@/lib/media';
import { shrinkToJpeg } from '@/lib/image-shrink';

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
  photo = false,
  remove,
  onSaved,
}: {
  value: string;
  onChange: (url: string) => void;
  upload: (base64: string) => Promise<string>;
  testId: string;
  label: string;
  disabled?: boolean;
  /**
   * A PHOTO rather than an artwork file (07-Oct-2026, takeaway orders): any image the phone can
   * read, a "Take photo" button that opens the camera where the device has one, and the picture
   * made small enough to send (`image-shrink.ts`). The server's check is unchanged.
   */
  photo?: boolean;
  /** Removing goes to the server and may fail; without it, Remove only clears the value. */
  remove?: () => Promise<void>;
  /** Told after a save or a removal went through, for the screen's own confirmation. */
  onSaved?: (what: 'saved' | 'removed') => void;
}) {
  const [problem, setProblem] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const choose = async (file: File | undefined): Promise<void> => {
    setProblem(null);
    if (!file) return;
    let bytes = new Uint8Array(await file.arrayBuffer());
    // A photo that is not already a PNG or JPEG of 1 MB or less is redrawn as one.
    if (photo && imageProblem(bytes) !== null) {
      setBusy('upload');
      const shrunk = await shrinkToJpeg(file);
      setBusy(null);
      if (shrunk) bytes = new Uint8Array(shrunk);
    }
    const why = imageProblem(bytes);
    if (why) {
      setProblem(why);
      reset();
      return;
    }
    setBusy('upload');
    try {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      onChange(await upload(btoa(binary)));
      onSaved?.('saved');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'That image could not be saved. Try again.');
    } finally {
      setBusy(null);
      reset();
    }
  };

  const takeAway = async (): Promise<void> => {
    setProblem(null);
    if (!remove) {
      onChange('');
      return;
    }
    setBusy('remove');
    try {
      await remove();
      onChange('');
      onSaved?.('removed');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'That image could not be removed. Try again.');
    } finally {
      setBusy(null);
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
            className={photo ? 'h-24 w-24 rounded-[var(--radius-md)] object-cover' : 'h-16 w-16 rounded-[var(--radius-md)] object-cover'}
          />
        ) : (
          <span
            className={cn(
              'flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-sunken)] type-caption text-[var(--text-muted)]',
              photo ? 'h-24 w-24' : 'h-16 w-16'
            )}
          >
            {photo ? 'No photo' : 'No image'}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={photo ? 'image/*' : 'image/png,image/jpeg'}
          className="sr-only"
          aria-label={label}
          data-testid={`${testId}-file`}
          disabled={disabled || busy !== null}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        {photo ? (
          /* `capture` opens the camera on a phone; a computer without one simply offers its files. */
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={`${label} - take a photo`}
            data-testid={`${testId}-camera`}
            disabled={disabled || busy !== null}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        ) : null}
        {photo ? (
          <Button
            data-testid={`${testId}-take`}
            size="sm"
            variant="secondary"
            disabled={disabled || busy !== null}
            onClick={() => cameraRef.current?.click()}
          >
            Take photo
          </Button>
        ) : null}
        <Button
          data-testid={`${testId}-choose`}
          size="sm"
          variant="secondary"
          disabled={disabled || busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === 'upload' ? 'Uploading…' : value ? 'Replace' : photo ? 'Choose photo' : 'Choose image'}
        </Button>
        {value ? (
          <Button
            data-testid={`${testId}-remove`}
            size="sm"
            variant="ghost"
            disabled={disabled || busy !== null}
            onClick={() => void takeAway()}
          >
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </Button>
        ) : null}
      </div>
      <p className="m-0 type-caption text-[var(--text-muted)]">
        {photo ? 'From the camera or the gallery. A large photo is made smaller before it is sent.' : 'PNG or JPEG, 1 MB at most.'}
      </p>
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
