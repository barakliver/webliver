import { redirect } from 'next/navigation';

/**
 * The playbook moved onto a shelf.
 *
 * It sat in the menu beside the system's own guides, and neither name said
 * which kind of knowledge it held. Kept as a redirect rather than deleted:
 * this address is in bookmarks, in the operating book's own cross references,
 * and in at least one message somebody sent themselves.
 */
export const dynamic = 'force-dynamic';

export default function SopMoved() {
  redirect('/app/knowledge?shelf=playbook');
}
