/**
 * Mounts the REAL `DataTable` with a menu-sized table (data-table-first-rows.render.spec.ts, 27-Oct-2026).
 * A layout effect beside it records how many rows the FIRST commit held — before any paint.
 */
import './process-shim';
import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DataTable } from '../../../src/components/ui/data-table';

declare global {
  interface Window {
    __firstCommitRows: number;
  }
}

const rows = Array.from({ length: 57 }, (_, i) => ({
  id: `d${i}`,
  name: `Dish ${String(i).padStart(2, '0')}`,
  price: 100 + i,
}));

function FirstCommit() {
  useLayoutEffect(() => {
    window.__firstCommitRows = document.querySelectorAll('[data-testid="probe-table"] tbody tr').length;
  }, []);
  return null;
}

const host = document.createElement('div');
document.body.prepend(host);
createRoot(host).render(
  <>
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'name', direction: 'asc' }}
      exportName="probe"
      emptyTitle="Empty"
      emptyNote="Nothing"
      testId="probe-table"
      columns={[
        { key: 'name', header: 'Item', cell: (r) => r.name, value: (r) => r.name },
        { key: 'price', header: 'Price', cell: (r) => String(r.price), value: (r) => r.price, align: 'right' },
      ]}
    />
    <FirstCommit />
  </>
);
