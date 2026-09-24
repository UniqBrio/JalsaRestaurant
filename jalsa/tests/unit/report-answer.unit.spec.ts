import { test, expect } from '@playwright/test';
import { NextResponse } from 'next/server.js';
import { readReportAnswer } from '../../src/lib/report-range';

/**
 * The Reports screen reading what `/api/owner/report` actually sends.
 *
 * WHY THESE CASES EXIST (RC-015)
 *   The route answers through `ok()` and `fail()` in `src/lib/route.ts`: the report IS the JSON
 *   body, and a refusal is `{ code, message }` at the top level. The screen was written against a
 *   `{ data, error }` envelope nothing on the server produces, so every report — every range,
 *   every day — arrived, was discarded, and was shown as "Nothing in this range".
 *
 *   The responses below are built with `NextResponse.json` exactly as `ok()` and `fail()` build
 *   them (route.ts imports 'server-only' and cannot be loaded here), so a change to either side
 *   of the contract has to change this file too.
 */

const REPORT = {
  range: { from: '2026-09-23', to: '2026-09-23' },
  summary: { bills: 1, sales: 828, salesLabel: '₹828' },
  orders: [{ code: 'B-1044', payable: 848 }],
};

async function answer(res: Response): Promise<ReturnType<typeof readReportAnswer<typeof REPORT>>> {
  return readReportAnswer<typeof REPORT>(res.ok, await res.json());
}

test('a closed bill the route returned is on the screen, not discarded', async () => {
  // What ok(report) sends.
  const read = await answer(NextResponse.json(REPORT, { status: 200 }));
  expect(read.problem).toBeNull();
  expect(read.report).toEqual(REPORT);
  expect(read.report?.orders[0]?.code).toBe('B-1044');
});

test('an empty range is an empty report, not a missing one', async () => {
  const empty = { ...REPORT, summary: { bills: 0, sales: 0, salesLabel: '₹0' }, orders: [] };
  const read = await answer(NextResponse.json(empty, { status: 200 }));
  expect(read.report).toEqual(empty);
  expect(read.problem).toBeNull();
});

test('a refusal shows the reason the server gave', async () => {
  // What fail(403, …) sends when the role lacks rep.sales.
  const read = await answer(
    NextResponse.json(
      { code: 'forbidden', message: 'Reports over a date range are not part of your role.', permission: 'rep.sales' },
      { status: 403 }
    )
  );
  expect(read.report).toBeNull();
  expect(read.problem).toBe('Reports over a date range are not part of your role.');
});

test('a refusal with no readable reason still says the report could not be read', async () => {
  const read = await answer(NextResponse.json({}, { status: 500 }));
  expect(read.report).toBeNull();
  expect(read.problem).toBe('The report could not be read.');
});
