import { spawn } from 'node:child_process';

/**
 * powershell — the one way this bridge runs a Windows script, and the reason it is safe.
 *
 * THE SCRIPT IS A CONSTANT, THE DATA IS AN ENVIRONMENT VARIABLE
 *   Every script this bridge runs is a string literal in its own source, sent as
 *   `-EncodedCommand` (base64 of UTF-16LE, which is what PowerShell expects). Anything that varies
 *   — a printer's queue name, a file path — is passed as an ENVIRONMENT VARIABLE and read inside
 *   the script as `$env:…`. Nothing variable is ever part of a command line, so a queue named
 *   `x"; Remove-Item C:\ -Recurse; "` is just a queue that does not exist.
 *
 * INJECTED WHERE IT IS USED, so discovery and the queue transport are testable off Windows. This
 * file is the part that is not: it is Windows-runtime pending until a real PC runs it.
 */

export interface ScriptRun {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type ScriptRunner = (input: {
  script: string;
  env: Record<string, string>;
  timeoutMs: number;
}) => Promise<ScriptRun>;

/** `-EncodedCommand` wants base64 of the UTF-16LE bytes. */
export const encodeCommand = (script: string): string => Buffer.from(script, 'utf16le').toString('base64');

/**
 * CreateProcess refuses a command line past 32,767 characters. Every script is checked against
 * this by a unit spec, so a script that grew too long fails in CI rather than on a kitchen PC.
 */
export const MAX_ENCODED = 30_000;

export const powershellRunner: ScriptRunner = ({ script, env, timeoutMs }) =>
  new Promise<ScriptRun>((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ code: null, stdout: '', stderr: `PowerShell scripts need Windows; this host is ${process.platform}.`, timedOut: false });
      return;
    }
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodeCommand(script)],
      { windowsHide: true, shell: false, env: { ...process.env, ...env } }
    );
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
