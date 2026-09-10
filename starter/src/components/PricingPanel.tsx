'use client';
/**
 * PricingPanel — ONE itemised money breakdown, reused by every module that shows a price.
 *
 * THE POINT OF MAKING THIS A COMPONENT
 *   Checkout, the quote dialog, the invoice preview and the printed receipt are four screens
 *   showing one calculation. Built four times they drift, and the day two of them disagree the
 *   customer stops believing any figure the product shows. One component, fed one breakdown
 *   from `lib/pricing`, cannot disagree with itself.
 *
 * WHAT THE MARKUP IS DOING
 *   Three columns — what · how it was worked out · the amount — which is under the CP-21
 *   threshold on purpose: a price breakdown that needs a column chooser has stopped being a
 *   price breakdown. Amounts are `<td>`s in a real table so screen readers announce the row
 *   header with the figure, and `print` inherits the same component (docs standard: printed
 *   artefacts are first-class, never a screenshot of a screen).
 *
 * THE TOTAL IS NOT COMPUTED HERE
 *   It is `breakdown.payable`, which is the sum of the rows above it by construction. A
 *   component that adds up its own props is the second implementation this file exists to
 *   prevent.
 */
import React from 'react';
import { computePricing, formatMoney, type PricingBreakdown, type PricingInput } from '../lib/pricing';
import './components.css';

export function PricingPanel({
  input,
  breakdown,
  title = 'Price breakdown',
  footnote,
  action,
  testId = 'pricing',
}: {
  /** Give it the input and it computes, or give it a breakdown computed once on the server. */
  input?: PricingInput;
  breakdown?: PricingBreakdown;
  title?: string;
  /** Terms, validity, "prices include tax" — the sentence a support call would ask for. */
  footnote?: string;
  /** The one primary action, if this panel carries one. Peers share a treatment (CP-19). */
  action?: React.ReactNode;
  testId?: string;
}) {
  const result = breakdown ?? computePricing(input ?? { lines: [] });
  const money = (n: number) => formatMoney(n, input ?? {});

  return (
    <section className="pricing" aria-labelledby={`${testId}-title`} data-testid={testId}>
      <h2 className="pricing__title" id={`${testId}-title`}>{title}</h2>

      {result.rows.length === 1 ? (
        // Not an error and not a spinner: nothing has been priced yet, and it says which.
        <p className="pricing__empty" data-testid={`${testId}-empty`}>
          Nothing has been added yet. Add an item and the price appears here.
        </p>
      ) : (
        <table className="pricing__table">
          <caption className="pricing__caption">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">How it is worked out</th>
              <th scope="col" className="pricing__amount-head">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr
                key={r.id}
                className={`pricing__row pricing__row--${r.role}`}
                data-role={r.role}
                data-testid={`${testId}-row-${r.id}`}
              >
                <th scope="row" className="pricing__label">{r.label}</th>
                <td className="pricing__detail">{r.detail ?? ''}</td>
                <td className="pricing__amount" data-testid={`${testId}-amount-${r.id}`}>{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pass-through money is named as such wherever it appears, so nobody reads it as income. */}
      {result.passThroughTotal !== 0 && (
        <p className="pricing__note" data-testid={`${testId}-passthrough-note`}>
          {money(result.passThroughTotal)} of this is collected on behalf of someone else and is
          not income.
        </p>
      )}

      {result.warnings.map((w, i) => (
        <p className="pricing__warning" key={w} data-testid={`${testId}-warning-${i}`}>{w}</p>
      ))}

      {footnote && <p className="pricing__footnote" data-testid={`${testId}-footnote`}>{footnote}</p>}
      {action && <div className="pricing__action">{action}</div>}
    </section>
  );
}
