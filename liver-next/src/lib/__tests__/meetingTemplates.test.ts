import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readField, readSections, templateFromRow, templateOf, questionCount } from '../meetingTemplates.ts';
import { INTRO_TEMPLATE, MEETING_TEMPLATES, BUILT_IN_TEMPLATES, fieldsOf } from '../../content/meetings.ts';

/**
 * A producer's own template is a jsonb column that was posted from a browser
 * once. The two things worth proving are that nothing bad in it reaches a
 * screen, and that nothing good in it — the ids the answers hang off — is
 * lost on the way.
 */

test('a field with no label is not a question', () => {
  assert.equal(readField({ kind: 'text' }, 'q1'), null);
  assert.equal(readField({ label: '   ' }, 'q1'), null);
  assert.equal(readField('a string', 'q1'), null);
  assert.equal(readField(null, 'q1'), null);
});

test('an unknown kind becomes text rather than a box nothing can draw', () => {
  assert.equal(readField({ label: 'x', kind: 'dropdown' }, 'q1')?.kind, 'text');
  assert.equal(readField({ label: 'x', kind: 'yesno' }, 'q1')?.kind, 'yesno');
});

test('the id the builder gave is kept, and a bad one is replaced', () => {
  assert.equal(readField({ id: 'f_abc12', label: 'x' }, 'q1')?.id, 'f_abc12');
  assert.equal(readField({ id: '"; drop table', label: 'x' }, 'q1')?.id, 'q1');
  assert.equal(readField({ label: 'x' }, 'q1')?.id, 'q1');
});

test('a choice with no options is a text field, and options are deduplicated', () => {
  assert.equal(readField({ label: 'x', kind: 'choice' }, 'q1')?.kind, 'text');
  assert.equal(readField({ label: 'x', kind: 'choice', options: [] }, 'q1')?.kind, 'text');
  const f = readField({ label: 'x', kind: 'choice', options: ['א', 'ב', 'א', '', 3] }, 'q1');
  assert.deepEqual(f?.options, ['א', 'ב', '3']);
});

test('two questions with one id do not share an answer', () => {
  const sections = readSections([
    { title: 'א', fields: [{ id: 'same', label: 'one' }, { id: 'same', label: 'two' }] },
  ]);
  const ids = fieldsOf({ kind: 'custom', title: '', when: '', offsetDays: null, blurb: '', sections }).map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], 'same');
});

test('a section with no questions is left out, and a broken row yields nothing', () => {
  assert.deepEqual(readSections([{ title: 'ריק', fields: [] }, 'x', null]), []);
  assert.deepEqual(readSections('not an array'), []);
  assert.deepEqual(readSections(undefined), []);
});

test('a row becomes a template the drawer cannot tell from a compiled-in one', () => {
  const t = templateFromRow({
    id: 'row1', name: '  שיחת היכרות  ', when_text: 'בהתחלה', offset_days: null, blurb: '',
    archived_at: null,
    sections: [{ title: 'מי', fields: [{ id: 'names', label: 'שמות', kind: 'text' }] }],
  });
  assert.equal(t.kind, 'custom');
  assert.equal(t.id, 'row1');
  assert.equal(t.title, 'שיחת היכרות');
  assert.equal(t.archived, false);
  assert.equal(questionCount(t), 1);
});

test('a log finds its template by kind, or by pointer, or not at all', () => {
  const own = [templateFromRow({
    id: 'row1', name: 'שלי', when_text: '', offset_days: null, blurb: '', archived_at: '2026-01-01',
    sections: [{ title: '', fields: [{ id: 'a', label: 'a', kind: 'text' }] }],
  })];
  assert.equal(templateOf({ kind: 'production' }, own)?.kind, 'production');
  assert.equal(templateOf({ kind: 'intro' }, own)?.kind, 'intro');
  /* Archived is still found: that is what archived is for. */
  assert.equal(templateOf({ kind: 'custom', template_id: 'row1' }, own)?.id, 'row1');
  assert.equal(templateOf({ kind: 'custom', template_id: 'gone' }, own), undefined);
  assert.equal(templateOf({ kind: 'custom', template_id: null }, own), undefined);
  assert.equal(templateOf({ kind: 'not-a-kind' }, own), undefined);
});

test('the first call is compiled in, first, and off the timeline', () => {
  assert.equal(BUILT_IN_TEMPLATES[0].kind, 'intro');
  assert.equal(INTRO_TEMPLATE.offsetDays, null);
  assert.ok(questionCount(INTRO_TEMPLATE) >= 10);
  /* The four coordination meetings are still four: the workflow seed that is
     named after them counts on it. */
  assert.equal(MEETING_TEMPLATES.length, 4);
  assert.ok(MEETING_TEMPLATES.every((m) => typeof m.offsetDays === 'number'));
});

test('no two compiled-in questions in one template share an id', () => {
  for (const t of BUILT_IN_TEMPLATES) {
    const ids = fieldsOf(t).map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, t.kind);
  }
});
