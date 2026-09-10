import type { Locale } from '../lib/locale.ts';
import {
  appCopy, guestsCopy, seatingCopy, dayCopy, threadCopy, partyCopy, contractCopy, eventFileCopy,
  noticeCopy, ticketCopy, companionCopy, prepCopy, venueCopy, envelopesCopy, vehiclesCopy,
  meetingTemplatesCopy, timelineCopy, studioCopy, journalCopy, circleCopy,
  leadsCopy, crewCopy, vendorCopy, templateCopy, barCopy, updateCopy, linkCopy, signCopy,
  siteEditorCopy, hebrewCalCopy, labelCopy, knowledgeCopy, jumpCopy, copilotCopy, archiveCopy,
  meetingCopy, workflowCopy, referralCopy,
} from './site.ts';
import {
  noticeCopyEn, ticketCopyEn, companionCopyEn, prepCopyEn, venueCopyEn, envelopesCopyEn, vehiclesCopyEn,
  meetingTemplatesCopyEn, timelineCopyEn, studioCopyEn, journalEn, circleEn,
  portalEn, filesEn, sheetsEn, tasksEn, moneyEn, boardEn, bookEn,
  guestsEn, seatingEn, dayEn, threadEn, partyEn, contractEn, eventFileEn,
} from './app.en.ts';
import {
  consoleEn, leadEn, crewEn, vendorEn, templateEn, barEn, updateEn, linkEn, signEn,
  siteEditorEn, hebrewCalEn, labelEn, knowledgeEn, jumpEn, copilotEn, archiveEn,
  meetingEn, workflowEn, referralEn,
} from './console.en.ts';

/**
 * The couple's own area, in whichever language they are reading.
 *
 * The public site was the visible half of this problem. The other half is
 * inside: a couple who presses EN in their own area gets the layout flipped to
 * left to right and every word still in Hebrew, which is the exact bug that
 * was just fixed outside the door.
 *
 * Scope is the couple's screens and nothing else. The producer's own console
 * stays Hebrew, deliberately: there is one producer, he works in Hebrew, and
 * an English admin is work nobody would ever read. Blocks shared between the
 * two sides are translated whole, because a half translated object is worse
 * than none.
 *
 * `Wide` does the same job it does for the public copy. The Hebrew blocks are
 * `as const`, so their type is the exact sentence; this widens every leaf to
 * its own kind while keeping the shape, so the English objects are checked for
 * having exactly the same keys and nesting and are free about the words.
 */
type Wide<T> =
  T extends (...args: never[]) => unknown ? T
  : T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends readonly [unknown, ...unknown[]] ? { readonly [K in keyof T]: Wide<T[K]> }
  : T extends readonly (infer U)[] ? readonly Wide<U>[]
  : { readonly [K in keyof T]: Wide<T[K]> };

export type PortalCopy = Wide<typeof appCopy.portal>;
export type FilesCopy = Wide<typeof appCopy.files>;
export type SheetsCopy = Wide<typeof appCopy.sheets>;
export type TasksCopy = Wide<typeof appCopy.tasks>;
export type BookCopy = Wide<typeof appCopy.book>;
export type MoneyCopy = Wide<typeof appCopy.money>;
export type BoardCopy = Wide<typeof appCopy.board>;
export type GuestsCopy = Wide<typeof guestsCopy>;
export type SeatingCopy = Wide<typeof seatingCopy>;
export type DayCopy = Wide<typeof dayCopy>;
export type ThreadCopy = Wide<typeof threadCopy>;
export type PartyCopy = Wide<typeof partyCopy>;
export type ContractCopy = Wide<typeof contractCopy>;
export type EventFileCopy = Wide<typeof eventFileCopy>;
/* The two pieces of chrome a couple meets on every screen: the bell and the
   bug button. They sit in the shell rather than in a panel, so they travel as
   props from the layout rather than through the provider. */
export type NoticeCopy = Wide<typeof noticeCopy>;
export type TicketCopy = Wide<typeof ticketCopy>;
/* The couple's assistant, which sits in the shell for the same reason those
   two do: it is on every screen of their area rather than inside one panel. */
export type CompanionCopy = Wide<typeof companionCopy>;
/* The faces and the looks. One panel read from two sides, so its words are
   resolved rather than provided: the producer's tab passes the Hebrew straight
   in, and the couple's area asks for their own language. */
export type PrepCopy = Wide<typeof prepCopy>;
export type EnvelopesCopy = Wide<typeof envelopesCopy>;
export type VehiclesCopy = Wide<typeof vehiclesCopy>;
export type MeetingTemplatesCopy = Wide<typeof meetingTemplatesCopy>;
export type TimelineCopy = Wide<typeof timelineCopy>;
/* The wedding's brand and its pieces, read from both sides. */
export type StudioCopy = Wide<typeof studioCopy>;
/* What the couple wrote at other people's weddings, and the circle of
   couples around one producer. Both are read from both sides. */
export type JournalCopy = Wide<typeof journalCopy>;
export type CircleCopy = Wide<typeof circleCopy>;
/* The halls. Both sides edit it and the couple is the side that toured them,
   so it is resolved rather than handed the console's Hebrew. */
export type VenueCopy = Wide<typeof venueCopy>;

/* The producer's console. The seven blocks the couple also reads were lifted
   out first and sit above; these are the rest of appCopy, whole, plus the
   standalone blocks each console screen imported by name. Every one of them
   now has an English twin, because the switch on the shell is offered to the
   producer too. */
type ConsoleKey =
  | 'signOut' | 'overview2' | 'profile' | 'insights' | 'dayOf' | 'brand' | 'nav' | 'pending'
  | 'overview' | 'leads' | 'clients' | 'admin' | 'newClient' | 'live' | 'guestImport' | 'calendar'
  | 'runsheet' | 'numbers' | 'guestSite' | 'statusBoard' | 'preview' | 'clientPage' | 'quickLedger';
export type ConsoleCopy = Wide<Pick<typeof appCopy, ConsoleKey>>;
export type LeadCopy = Wide<typeof leadsCopy>;
export type CrewCopy = Wide<typeof crewCopy>;
export type VendorCopy = Wide<typeof vendorCopy>;
export type TemplateCopy = Wide<typeof templateCopy>;
export type BarCopy = Wide<typeof barCopy>;
export type UpdateCopy = Wide<typeof updateCopy>;
export type LinkCopy = Wide<typeof linkCopy>;
export type SignCopy = Wide<typeof signCopy>;
export type SiteEditorCopy = Wide<typeof siteEditorCopy>;
export type HebrewCalCopy = Wide<typeof hebrewCalCopy>;
export type LabelCopy = Wide<typeof labelCopy>;
export type KnowledgeCopy = Wide<typeof knowledgeCopy>;
export type JumpCopy = Wide<typeof jumpCopy>;
export type CopilotCopy = Wide<typeof copilotCopy>;
export type ArchiveCopy = Wide<typeof archiveCopy>;
export type MeetingCopy = Wide<typeof meetingCopy>;
export type WorkflowCopy = Wide<typeof workflowCopy>;
export type ReferralCopy = Wide<typeof referralCopy>;

/** Everything a screen reads, resolved together. One object rather than
 *  forty lookups, because it travels as one value through one context rather
 *  than as a prop down forty component trees. The couple's blocks and the
 *  producer's are one object on purpose: the shell is shared, and a producer
 *  previewing the couple's screen reads both in the same language. */
export type AppUi = {
  /* The language travels with the words, because several of these screens
     format a date or a time and a formatter locked to he-IL would print a
     Hebrew month inside an otherwise English panel. */
  locale: Locale;
  /* Shown above a screen where a read failed, so an empty list stops
     reading as a fact about the event. */
  loadTrouble: string;
  portal: PortalCopy; files: FilesCopy; sheets: SheetsCopy;
  tasks: TasksCopy; money: MoneyCopy; board: BoardCopy; book: BookCopy;
  guests: GuestsCopy; seating: SeatingCopy; day: DayCopy;
  thread: ThreadCopy; party: PartyCopy; contract: ContractCopy;
  eventFile: EventFileCopy;
  /* The producer's own screens, by the name each one imported. `leads` is
     the leads page's own two lines; `lead` is the row, the call and the form. */
  lead: LeadCopy; crew: CrewCopy; vendor: VendorCopy; template: TemplateCopy;
  bar: BarCopy; update: UpdateCopy; link: LinkCopy; sign: SignCopy;
  siteEditor: SiteEditorCopy; hebrewCal: HebrewCalCopy; label: LabelCopy;
  knowledge: KnowledgeCopy; jump: JumpCopy; copilot: CopilotCopy; archive: ArchiveCopy;
  meeting: MeetingCopy; workflow: WorkflowCopy; referral: ReferralCopy;
  meetingTemplates: MeetingTemplatesCopy;
  timeline: TimelineCopy;
  studio: StudioCopy;
  journal: JournalCopy;
  circle: CircleCopy;
} & ConsoleCopy;

const consoleHe: ConsoleCopy = {
  signOut: appCopy.signOut, overview2: appCopy.overview2, profile: appCopy.profile,
  insights: appCopy.insights, dayOf: appCopy.dayOf, brand: appCopy.brand, nav: appCopy.nav,
  pending: appCopy.pending, overview: appCopy.overview, leads: appCopy.leads,
  clients: appCopy.clients, admin: appCopy.admin, newClient: appCopy.newClient, live: appCopy.live,
  guestImport: appCopy.guestImport, calendar: appCopy.calendar, runsheet: appCopy.runsheet,
  numbers: appCopy.numbers, guestSite: appCopy.guestSite, statusBoard: appCopy.statusBoard,
  preview: appCopy.preview, clientPage: appCopy.clientPage, quickLedger: appCopy.quickLedger,
};

export const APP_UI_HE: AppUi = {
  locale: 'he',
  loadTrouble: appCopy.loadTrouble,
  portal: appCopy.portal, files: appCopy.files, sheets: appCopy.sheets,
  tasks: appCopy.tasks, money: appCopy.money, board: appCopy.board, book: appCopy.book,
  guests: guestsCopy, seating: seatingCopy, day: dayCopy,
  thread: threadCopy, party: partyCopy, contract: contractCopy,
  eventFile: eventFileCopy,
  lead: leadsCopy, crew: crewCopy, vendor: vendorCopy, template: templateCopy,
  bar: barCopy, update: updateCopy, link: linkCopy, sign: signCopy,
  siteEditor: siteEditorCopy, hebrewCal: hebrewCalCopy, label: labelCopy,
  knowledge: knowledgeCopy, jump: jumpCopy, copilot: copilotCopy, archive: archiveCopy,
  meeting: meetingCopy, workflow: workflowCopy, referral: referralCopy,
  meetingTemplates: meetingTemplatesCopy,
  timeline: timelineCopy,
  studio: studioCopy,
  journal: journalCopy, circle: circleCopy,
  ...consoleHe,
};

const APP_UI_EN: AppUi = {
  locale: 'en',
  loadTrouble: 'Some of this screen did not load. Things may be missing, so do not trust an empty list until you refresh.',
  portal: portalEn, files: filesEn, sheets: sheetsEn,
  tasks: tasksEn, money: moneyEn, board: boardEn, book: bookEn,
  guests: guestsEn, seating: seatingEn, day: dayEn,
  thread: threadEn, party: partyEn, contract: contractEn,
  eventFile: eventFileEn,
  lead: leadEn, crew: crewEn, vendor: vendorEn, template: templateEn,
  bar: barEn, update: updateEn, link: linkEn, sign: signEn,
  siteEditor: siteEditorEn, hebrewCal: hebrewCalEn, label: labelEn,
  knowledge: knowledgeEn, jump: jumpEn, copilot: copilotEn, archive: archiveEn,
  meeting: meetingEn, workflow: workflowEn, referral: referralEn,
  meetingTemplates: meetingTemplatesCopyEn,
  timeline: timelineCopyEn,
  studio: studioCopyEn,
  journal: journalEn, circle: circleEn,
  ...consoleEn,
};

export const appUiFor = (l: Locale): AppUi => (l === 'en' ? APP_UI_EN : APP_UI_HE);

export const noticeFor = (l: Locale): NoticeCopy => (l === 'en' ? noticeCopyEn : noticeCopy);
export const ticketFor = (l: Locale): TicketCopy => (l === 'en' ? ticketCopyEn : ticketCopy);
export const companionFor = (l: Locale): CompanionCopy => (l === 'en' ? companionCopyEn : companionCopy);
export const prepFor = (l: Locale): PrepCopy => (l === 'en' ? prepCopyEn : prepCopy);
export const envelopesFor = (l: Locale): EnvelopesCopy => (l === 'en' ? envelopesCopyEn : envelopesCopy);
export const vehiclesFor = (l: Locale): VehiclesCopy => (l === 'en' ? vehiclesCopyEn : vehiclesCopy);
export const meetingTemplatesFor = (l: Locale): MeetingTemplatesCopy =>
  (l === 'en' ? meetingTemplatesCopyEn : meetingTemplatesCopy);
export const venuesFor = (l: Locale): VenueCopy => (l === 'en' ? venueCopyEn : venueCopy);
