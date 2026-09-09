import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows } from '@/lib/safe';
import type { MeetingTemplate } from '@/content/meetings';
import { templateFromRow, type MeetingTemplateRow } from '@/lib/meetingTemplates';

/**
 * The producer's own meeting forms, every one of them.
 *
 * Archived ones ride along on purpose: the drawer needs them to put labels on
 * a log that was written from one, and it filters them out of the buttons
 * itself. Row level security scopes the read to whoever is asking, so there
 * is no producer filter here and there does not need to be one.
 */
export async function loadMeetingTemplates(sb: SupabaseClient<any, any, any>): Promise<MeetingTemplate[]> {
  const rows = await safeRows<MeetingTemplateRow>('meeting_templates', sb.from('meeting_templates')
    .select('id,name,when_text,offset_days,blurb,sections,archived_at')
    .order('sort_order').order('created_at'));
  return rows.map(templateFromRow);
}
