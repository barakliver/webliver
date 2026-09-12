import file from '../../version.json';

/**
 * Which version of the platform this build is.
 *
 * Baked in at build time, so the number a screen shows is the number of the
 * code drawing that screen, and cannot drift from it. The agent on the
 * droplet reads the same file out of git for the commit it is putting live,
 * and writes it beside that commit — which is what lets the owner's console
 * say "Liver 2.0 is live, 1.9 was before it" instead of printing two hashes
 * and leaving the reader to work out which is newer.
 *
 * The word before the number lives in the copy, not here. The platform is
 * white labelled, and a product name compiled into a library is a product
 * name that eventually appears on somebody else's screen.
 */
export const VERSION: string = file.version;
