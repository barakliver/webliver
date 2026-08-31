import type { SiteCopy } from '@/content/site';
import { publicEnv } from '@/lib/env';

/**
 * What the page tells a machine about the business.
 *
 * The audit found zero structured data and a title with no service and no
 * region in it, and put both under the same heading: nothing here can be
 * ranked, because nothing here says what is being sold or to whom. The title
 * has since been fixed. This is the other half.
 *
 * Two rules held while writing it.
 *
 * Everything asserted is true and checkable on the page itself. There is no
 * `aggregateRating`, no `review`, and no `priceRange`, because there are no
 * verified reviews to count and no published price to name. Inventing either
 * is how a business earns a manual action, and it would also be a lie told on
 * his behalf.
 *
 * And every string is read from the copy that renders, `SiteCopy`, rather than
 * written out again here. A description that is typed twice is a description
 * that eventually disagrees with itself, and the half nobody reads is the half
 * that goes stale.
 */
export function StructuredData({ site }: { site: SiteCopy }) {
  const url = publicEnv.siteUrl;
  const phone = publicEnv.whatsapp
    ? `+${publicEnv.whatsapp.replace(/\D/g, '')}`
    : undefined;

  const business = {
    '@type': 'ProfessionalService',
    '@id': `${url}/#business`,
    name: site.brand,
    description: site.hero.body.join(' '),
    url,
    image: `${url}/og.jpg`,
    email: publicEnv.contactEmail,
    ...(phone ? { telephone: phone } : {}),
    /* He works across the country rather than out of a shopfront, so the
       area is a country and there is no street address to claim. */
    areaServed: { '@type': 'Country', name: 'IL' },
    knowsLanguage: ['he', 'en'],
    founder: { '@id': `${url}/#barak` },
    /* One offer, and its name is a service rather than a sentence. The course
       is on the page too, but its heading there is a question addressed to the
       reader, and a question is not the name of a thing that can be bought. */
    makesOffer: [{
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: site.tagline, serviceType: site.tagline },
    }],
  };

  const person = {
    '@type': 'Person',
    '@id': `${url}/#barak`,
    name: site.hero.name,
    jobTitle: site.tagline,
    description: site.about.body[0],
    url,
    worksFor: { '@id': `${url}/#business` },
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    url,
    name: site.brand,
    inLanguage: 'he-IL',
    publisher: { '@id': `${url}/#business` },
  };

  const graph = { '@context': 'https://schema.org', '@graph': [business, person, website] };

  return (
    /* `JSON.stringify` and not a template string: the copy is his, it contains
       quotation marks, and a hand built JSON string breaks the moment one
       appears. The `<` is escaped because a `</script` inside a value would
       otherwise close this element early. */
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
    />
  );
}
