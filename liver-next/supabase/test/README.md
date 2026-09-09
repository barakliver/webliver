# Running the schema against a real database

`setup.sql` is 4,300 lines of policy. Reading it proves nothing; the two bugs
found on the day it was written were both invisible on the page and obvious the
moment it ran.

These files stand a throwaway Postgres up, apply the schema, seed two
independent businesses and a couple, and then try to break the tenant boundary
from the inside. No Supabase account is involved and nothing here touches
production.

```bash
scripts/db-test.sh
```

Requires a local `postgres` binary (any 15 or 16). Everything else is here.

* `00_shim.sql` — enough of Supabase to run: the roles, `auth.uid()`, the
  storage tables, the `extensions` schema. Not a claim about how Supabase
  behaves, just the surface `setup.sql` reaches for.
* `01_seed.sql` — root, a second producer, and a couple on the second
  producer's wedding, with guests, budget, contracts, messages, crew and leads.
* `02_boundary.sql` — every table root must not be able to read, run as root.
  A count that is not zero is a breach. Then the couple's own wall.
* `03_invite.sql` — the invitation that used to throw.
