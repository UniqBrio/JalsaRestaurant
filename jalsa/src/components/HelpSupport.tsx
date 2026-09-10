'use client';
/**
 * HelpSupport - how a stuck user reaches a human.
 *
 * WHY THE CHANNELS ARE LINKS AND NOT BUTTONS
 *   `mailto:`, `tel:` and the WhatsApp deep link are navigations, so they are anchors. That
 *   gives long-press, "copy address", open-in-new-tab and the platform's own handling for
 *   free - all of which a click handler on a styled element would have to re-implement, badly.
 *
 * EVERY CHANNEL IS LABELLED IN WORDS
 *   An icon alone is a riddle (docs/23 - what NOT to do), and this is the screen a frustrated
 *   user reaches. The icon is decoration beside the word, marked aria-hidden, never the only
 *   affordance.
 *
 * A CHANNEL WITH NO VALUE IS NOT RENDERED
 *   An empty "Call us" that dials nothing is worse than no call option: it costs a tap and
 *   teaches the user that support is broken. Absent contact details mean the channel is absent,
 *   and if every channel is absent the component says so honestly.
 */
import React from 'react';

/** WhatsApp deep links take digits only - no +, spaces, dashes or parentheses. */
export const whatsappNumber = (raw: string): string => raw.replace(/\D/g, '');

export function HelpSupport({
  email,
  phone,
  /** Defaults to `phone` when the support line is the same number. */
  whatsapp,
  whatsappMessage,
  heading = 'Help and support',
  note,
  testId = 'help',
}: {
  email?: string;
  phone?: string;
  whatsapp?: string;
  /** Pre-filled first message, so the user does not have to explain where they came from. */
  whatsappMessage?: string;
  heading?: string;
  /** e.g. "We reply within one working day." Sets an expectation instead of leaving one. */
  note?: string;
  testId?: string;
}) {
  const wa = whatsappNumber(whatsapp ?? phone ?? '');
  const waHref = wa
    ? `https://wa.me/${wa}${whatsappMessage ? `?text=${encodeURIComponent(whatsappMessage)}` : ''}`
    : null;

  const hasAny = Boolean(email || phone || waHref);

  return (
    <section className="help" aria-labelledby={`${testId}-heading`} data-testid={testId}>
      <h2 className="help__heading" id={`${testId}-heading`}>
        {heading}
      </h2>

      {!hasAny ? (
        <p className="help__empty" data-testid={`${testId}-empty`}>
          Support contact details have not been set up yet.
        </p>
      ) : (
        <ul className="help__channels">
          {email && (
            <li className="help__channel">
              <a data-testid={`${testId}-email`} className="help__link" href={`mailto:${email}`}>
                <span className="help__icon" aria-hidden="true">
                  ✉
                </span>
                <span className="help__label">Email us</span>
                <span className="help__value">{email}</span>
              </a>
            </li>
          )}
          {phone && (
            <li className="help__channel">
              <a data-testid={`${testId}-call`} className="help__link" href={`tel:${phone.replace(/\s+/g, '')}`}>
                <span className="help__icon" aria-hidden="true">
                  ✆
                </span>
                <span className="help__label">Call us</span>
                <span className="help__value">{phone}</span>
              </a>
            </li>
          )}
          {waHref && (
            <li className="help__channel">
              <a
                data-testid={`${testId}-whatsapp`}
                className="help__link"
                href={waHref}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="help__icon" aria-hidden="true">
                  ☏
                </span>
                <span className="help__label">WhatsApp</span>
                <span className="help__value">Opens WhatsApp</span>
              </a>
            </li>
          )}
        </ul>
      )}

      {note && <p className="help__note">{note}</p>}
    </section>
  );
}
