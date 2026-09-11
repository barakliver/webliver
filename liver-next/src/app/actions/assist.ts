'use server';

import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { optional } from '@/lib/env';
import { serverCopy } from '@/lib/serverLocale';
import { shortDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { normalizePhone } from '@/lib/phone';
import { questionsFor, templateDraft, factLines, type DraftCopy, type EventFactsForDraft } from '@/lib/assist';
import type { QuoteVendor } from '@/lib/quotes';

export type DraftResult = {
  ok: boolean;
  error?: string;
  /** What is known, from rows the caller can read. Drawn as facts. */
  facts?: string[];
  /** The message, to edit. Drawn as a suggestion, never as a fact. */
  draft?: string;
  /** Who wrote the draft. The screen says so beside it. */
  by?: 'model' | 'template';
  /** Where it would go, in the form wa.me takes; null when the supplier has
   *  no phone on the row and the message is for copying. */
  phone?: string | null;
};

/**
 * A message to a supplier, drafted from what the screen already knows.
 *
 * Round five of the planning brief: help that reads the screen it is on and
 * offers the one thing worth doing there. On a quote with blanks, that is
 * asking the supplier to fill them in, with the wedding's own facts in the
 * message so they do not have to ask back.
 *
 * Two authors, one message. The template in lib/assist writes it from the
 * facts and the open questions, deterministically, and that is the whole of
 * the manual workflow: it works with no key and no network. When a key is
 * present the model is asked to say the same thing more warmly — the same
 * facts, the same questions, in Hebrew or English as the reader is reading,
 * and nothing else. It is told not to invent a price, a date or a promise,
 * and if it fails, refuses, or the key is missing, the template goes out as
 * it is and the screen says which author it got.
 *
 * Nothing is written and nothing is sent. The caller opens WhatsApp with the
 * text the person edited, or copies it, and a person presses send.
 */
export async function draftSupplierMessage(input: { eventVendorId: string }): Promise<DraftResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };
  if (!input.eventVendorId) return { ok: false, error: 'חסר ספק' };

  const ui = await serverCopy();
  const c = ui.vendor.quotes.assist;
  const sb = await supabaseServer();

  /* Under the caller's own policies: a supplier on somebody else's event
     comes back as nothing and the draft is refused, not invented. */
  const { data: vendor } = await sb.from('event_vendors')
    .select('id,client_id,name,category,phone,status,chosen,quote_amount,quote_hours,quote_scope,quote_includes,quote_extras,quote_terms')
    .eq('id', input.eventVendorId).maybeSingle();
  if (!vendor) return { ok: false, error: c.noSupplier };

  const { data: client } = await sb.from('clients')
    .select('display_name,event_date,guest_estimate,region')
    .eq('id', vendor.client_id as string).maybeSingle();
  if (!client) return { ok: false, error: c.noSupplier };

  /* Who signs: the producer under their business's name, the couple under
     the event's own name. The business name is the brand the couple sees,
     and the couple has no brand. */
  const signAs = account.role === 'client'
    ? String(client.display_name)
    : (account.producer?.brandName?.trim() || account.fullName || String(client.display_name));

  const v = vendor as unknown as QuoteVendor;
  const facts: EventFactsForDraft = {
    eventName: String(client.display_name),
    eventDate: (client.event_date as string | null) ?? null,
    guests: client.guest_estimate === null || client.guest_estimate === undefined ? null : Number(client.guest_estimate),
    region: String(client.region ?? ''),
    signAs,
  };
  const dateText = facts.eventDate ? formatDate(shortDate(ui.locale), facts.eventDate, '') : null;
  const copy: DraftCopy = {
    greeting: c.greeting, about: c.about, onDate: c.onDate, guests: c.guests, inRegion: c.inRegion,
    haveQuote: c.haveQuote, askIntro: c.askIntro, questions: c.questions, closing: c.closing,
  };

  const factList = factLines(v, facts, copy, dateText);
  const template = templateDraft(v, facts, copy, dateText);
  const phone = normalizePhone(String(vendor.phone ?? ''));

  const prose = await askModel(template, factList, questionsFor(v).map((q) => c.questions[q]), ui.locale);
  return {
    ok: true,
    facts: factList,
    draft: prose ?? template,
    by: prose ? 'model' : 'template',
    phone,
  };
}

/**
 * The warmer version, when there is a key for one.
 *
 * Given the template and the fact list and nothing else — no guest list, no
 * budget, no other supplier — so the most it can do is rephrase. Every path
 * out returns a string or null, and null means the template stands.
 */
async function askModel(template: string, facts: string[], questions: string[], locale: string): Promise<string | null> {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) return null;

  const lang = locale === 'en' ? 'English' : 'Hebrew';
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: optional('ANTHROPIC_MODEL', 'claude-opus-5'),
      max_tokens: 600,
      output_config: { effort: 'low' },
      system:
        `You rewrite a short WhatsApp message from a wedding's planner to a supplier, in ${lang}. `
        + 'Keep every fact and every question exactly as given; do not add a price, a date, a promise or a fact that is not in the input. '
        + 'Warm, plain and brief: under 110 words, the questions as a bullet list, the same sign-off. '
        + 'Return only the message text.',
      messages: [{
        role: 'user',
        content: `Facts:\n${facts.map((f) => `- ${f}`).join('\n')}\n\nQuestions to ask:\n${questions.map((q) => `- ${q}`).join('\n')}\n\nDraft to rewrite:\n${template}`,
      }],
    });

    if (res.stop_reason === 'refusal') return null;
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    /* A rewrite that dropped a question is worse than the template, which
       asks all of them. Checked the cheap way: every question's first four
       words have to be in the result. */
    const kept = questions.every((q) => text.includes(q.split(' ').slice(0, 4).join(' ')));
    return text && kept ? text : null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error('[assist] the model could not draft', { status: e.status, message: e.message });
    } else {
      console.error('[assist] the model could not draft', { message: e instanceof Error ? e.message : String(e) });
    }
    return null;
  }
}
