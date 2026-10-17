/**
 * How an instalment can have been paid. Closed, because the cash-flow screen
 * groups by it and a free-text method would give "העברה", "העברה בנקאית" and
 * "bank" as three lines. It is a list of keys, never of words: the words are
 * the screen's, in both languages.
 */
export const PAY_METHODS = ['transfer', 'card', 'cash', 'check', 'app', 'other'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export const JOINT_PAYER = '__joint';
