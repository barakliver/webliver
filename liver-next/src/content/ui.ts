import type { Locale } from '../lib/locale.ts';
import {
  auth, privacyCopy, termsCopy, a11yCopy, installCopy, storeCopy, rsvpCopy, budgetSimCopy,
  conciergeCopy, guestSiteCopy, producerEntryCopy, EVENT_KINDS, notFoundCopy, siteErrorCopy,
} from './site.ts';
import {
  authEn, privacyCopyEn, termsCopyEn, a11yCopyEn, installCopyEn, storeCopyEn, rsvpCopyEn,
  budgetSimCopyEn, conciergeCopyEn, guestSiteCopyEn, producerEntryCopyEn, EVENT_KINDS_EN,
  notFoundCopyEn, siteErrorCopyEn,
} from './site.en.ts';

/**
 * The screens a visitor can reach in either language.
 *
 * The site already had two languages and a toggle, and the toggle already
 * worked: pressing EN flipped the document to `dir="ltr"` and rendered the
 * home page in English. Every other public page kept its Hebrew and got laid
 * out left to right, which is worse than not offering English at all. A
 * measurement rather than an impression: the terms page came back with 3,231
 * Hebrew characters in an LTR document.
 *
 * `Wide` is the reason nothing below had to be rewritten. The Hebrew blocks
 * are `as const`, so their type is the exact sentence rather than `string`,
 * and an English object typed against them would have to say the same words
 * in Hebrew to compile. This widens every leaf to its own kind while keeping
 * the shape, so the English objects are checked for having exactly the same
 * keys, the same nesting and the same tuple lengths, and are free about the
 * words. Add a key to one and the other stops compiling.
 *
 * The producer's own screens are not here on purpose. There is one producer,
 * he works in Hebrew, and translating the admin would be work nobody reads.
 */
type Wide<T> =
  T extends (...args: never[]) => unknown ? T
  : T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends readonly [unknown, ...unknown[]] ? { readonly [K in keyof T]: Wide<T[K]> }
  : T extends readonly (infer U)[] ? readonly Wide<U>[]
  : { readonly [K in keyof T]: Wide<T[K]> };

export type AuthCopy = Wide<typeof auth>;
export type PrivacyCopy = Wide<typeof privacyCopy>;
export type TermsCopy = Wide<typeof termsCopy>;
export type A11yCopy = Wide<typeof a11yCopy>;
export type InstallCopy = Wide<typeof installCopy>;
export type NotFoundCopy = Wide<typeof notFoundCopy>;
export type SiteErrorCopy = Wide<typeof siteErrorCopy>;
/* The shopfront only. `storeCopy` also carries the producer's own screens for
   editing the catalogue and dragging orders between columns, and translating
   those would be work nobody reads: there is one producer and he works in
   Hebrew. Picking the keys the public component actually reads means adding an
   admin string never asks for an English one, and adding a shopfront string
   does. */
const SHOP_KEYS = [
  'shopTitle', 'shopSub', 'shopEmpty', 'addToCart', 'cart', 'qty', 'clear',
  'checkout', 'sending', 'cancel', 'total', 'kindProduct', 'kindService',
  'buyerName', 'buyerPhone', 'buyerEmail', 'buyerNote', 'buyerNotePh',
  'payLater', 'thanksTitle', 'thanks', 'again', 'failed',
] as const;

export type ShopCopy = Wide<Pick<typeof storeCopy, (typeof SHOP_KEYS)[number]>>;

/* Narrowed at run time as well as in the type. The Hebrew object is a superset
   and assignable, so the types were happy handing the whole of `storeCopy` to
   the shopfront: every admin string, including the wording of the orders board,
   serialised into the page of anybody browsing the shop. */
const shopHe = Object.fromEntries(SHOP_KEYS.map((k) => [k, storeCopy[k]])) as ShopCopy;
export type RsvpCopy = Wide<typeof rsvpCopy>;
export type GuestSiteCopy = Wide<typeof guestSiteCopy>;
export type ProducerEntryCopy = Wide<typeof producerEntryCopy>;
export type BudgetSimCopy = Wide<typeof budgetSimCopy>;
export type ConciergeCopy = Wide<typeof conciergeCopy>;
export type EventKinds = Wide<typeof EVENT_KINDS>;

/* One lookup per block rather than one big object, because a page that renders
   the privacy policy has no reason to pull the shop's wording along with it. */
export const authFor = (l: Locale): AuthCopy => (l === 'en' ? authEn : auth);
export const privacyFor = (l: Locale): PrivacyCopy => (l === 'en' ? privacyCopyEn : privacyCopy);
export const termsFor = (l: Locale): TermsCopy => (l === 'en' ? termsCopyEn : termsCopy);
export const a11yFor = (l: Locale): A11yCopy => (l === 'en' ? a11yCopyEn : a11yCopy);
export const installFor = (l: Locale): InstallCopy => (l === 'en' ? installCopyEn : installCopy);
export const storeFor = (l: Locale): ShopCopy => (l === 'en' ? storeCopyEn : shopHe);
export const rsvpFor = (l: Locale): RsvpCopy => (l === 'en' ? rsvpCopyEn : rsvpCopy);
export const guestSiteFor = (l: Locale): GuestSiteCopy => (l === 'en' ? guestSiteCopyEn : guestSiteCopy);
export const producerEntryFor = (l: Locale): ProducerEntryCopy => (l === 'en' ? producerEntryCopyEn : producerEntryCopy);
export const notFoundFor = (l: Locale): NotFoundCopy => (l === 'en' ? notFoundCopyEn : notFoundCopy);
export const siteErrorFor = (l: Locale): SiteErrorCopy => (l === 'en' ? siteErrorCopyEn : siteErrorCopy);
export const budgetSimFor = (l: Locale): BudgetSimCopy => (l === 'en' ? budgetSimCopyEn : budgetSimCopy);
export const conciergeFor = (l: Locale): ConciergeCopy => (l === 'en' ? conciergeCopyEn : conciergeCopy);
export const eventKindsFor = (l: Locale): EventKinds => (l === 'en' ? EVENT_KINDS_EN : EVENT_KINDS);
