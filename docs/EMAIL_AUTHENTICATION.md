# Email authentication (SPF, DKIM, DMARC) for kallo.fit

Staged runbook for moving `kallo.fit` from DMARC **monitoring** to
**enforcement**, so nobody else can send mail that claims to be from us.
Pentest finding **KALLO-04** (2026-09-08) recorded:

```text
kallo.fit         TXT  "v=spf1 include:_spf.mx.cloudflare.net ~all"
_dmarc.kallo.fit  TXT  "v=DMARC1; p=none; rua=mailto:..."
```

`p=none` asks receivers to report failures and do nothing else, and `~all`
marks unknown senders as a soft fail. Together they leave the domain easy to
spoof for fake password-reset or billing mail. Nothing here is code — every
change is a DNS record the owner edits in Cloudflare (**DNS → Records**), or a
setting in the Cloudflare, Resend or Supabase dashboard. Where a value depends
on a vendor's live configuration, this page says **copy from dashboard**
rather than guessing it.

Context: inbound mail setup is `docs/PROD_DOMAIN_SETUP.md` §7, outbound is §7b,
and the code path is `docs/EMAIL.md`.

## 1. The three checks, and alignment

- **SPF** (TXT on the *envelope* sender's domain, the `Return-Path`): which
  servers may send for that domain. `-all` = "anything else fails", `~all` =
  "anything else is suspicious".
- **DKIM** (public key at `<selector>._domainkey.<domain>`): a signature over the
  message; the signer's domain is its `d=` tag. A pass proves the signed parts
  were not altered and that `d=` really signed it.
- **DMARC** (TXT at `_dmarc.<domain>`): the policy for the domain in the visible
  `From:` header. A message passes DMARC if **either** SPF or DKIM passes **and
  is aligned** with the `From:` domain. `p=` tells receivers what to do when
  both fail: `none` (report only), `quarantine` (treat as suspicious —
  usually the spam folder, but a receiver may hold, drop or bounce it),
  `reject` (bounce).

**Alignment** is what stops an attacker passing SPF for `evil.example` while
showing `From: billing@kallo.fit`:

- **Relaxed** (`adkim=r` / `aspf=r`, the default): the domains only need the
  same *organizational domain*. `mail.kallo.fit`, `send.mail.kallo.fit` and
  `kallo.fit` all share the org domain `kallo.fit`, so a DKIM `d=mail.kallo.fit`
  would even align with a `From: …@kallo.fit`.
- **Strict** (`s`): the domains must be identical.

## 2. Inventory of legitimate senders

| From: domain | Who sends | Envelope (`Return-Path`) | DKIM `d=` | DMARC result |
|---|---|---|---|---|
| `mail.kallo.fit` | Resend: every app email, auth mail via the Supabase Send Email hook, waitlist (`lib/infra/email/config.ts`, default `notifications@mail.kallo.fit`) | `send.mail.kallo.fit` (Resend's default Return-Path) | `mail.kallo.fit` (`resend._domainkey.mail`) | DKIM aligned even under strict; SPF aligned under relaxed only |
| `kallo.fit` | **Nothing we know of** | — | — | — |

Not senders for our domain, so DMARC on `kallo.fit` does not touch them:

- **Cloudflare Email Routing** (inbound `support@kallo.fit`) only forwards.
  Forwarded mail keeps the *original* author's `From:` (e.g. `@gmail.com`), so
  the author's DMARC applies, not ours. Cloudflare rewrites the envelope sender
  with the **Sender Rewriting Scheme (SRS)** to a Cloudflare-controlled domain
  so SPF still passes at your inbox, and adds ARC and DKIM signatures
  ([Cloudflare postmaster][cf-postmaster]). The apex
  `include:_spf.mx.cloudflare.net` is the record Email Routing installs
  ([Email Routing DNS records][cf-routing-dns]); keep it.
- **Supabase's built-in mailer** (the rollback path when the hook is off) sends
  from Supabase's own domain, not ours.
- **Paddle** receipts and portal magic links come from Paddle's domain.

**Confirm before enforcing** — these would be `@kallo.fit` senders and would
break under `p=reject`:

- [ ] Nobody replies to support mail *as* `support@kallo.fit` (e.g. Gmail
      **Settings → Accounts → Send mail as**). Replies from a personal address
      are fine. If you do want to reply as `support@`, send through a provider
      that DKIM-signs for `kallo.fit` first.
- [ ] Supabase dashboard → **Authentication** → the SMTP settings page has no
      custom SMTP with an `@kallo.fit` sender (`supabase/config.toml` keeps it
      commented out).
- [ ] No other tool (newsletter, CRM, Google Workspace, status page) was set up
      to send as `@kallo.fit` or any other subdomain.
- [ ] `EMAIL_FROM` on Cloud Run, if set, is still on `mail.kallo.fit`.

If the apex really sends nothing, it can go straight to a strict policy; only
`mail.kallo.fit` needs the careful staging.

## 3. Read the aggregate reports first

Aggregate (`rua`) reports are daily XML files from each big receiver listing
every IP that sent as your domain and whether SPF/DKIM passed aligned. They are
how you find a sender you forgot.

1. Cloudflare → **Email → DMARC Management → Enable DMARC Management** (all
   plans). It adds its own `rua` address to the existing record rather than
   replacing it ([enable DMARC Management][cf-dmarc]). Alternatives: Resend's
   open-source [DMARC analyzer][resend-analyzer], or any report service.
2. If the existing `rua=` points at a mailbox on a *different* domain, that
   domain must publish an authorization record
   (`kallo.fit._report._dmarc.<their-domain>`); report services do this for
   you. Check the current value: `dig +short TXT _dmarc.kallo.fit`.
3. Check whether a separate record exists for the sending subdomain:
   `dig +short TXT _dmarc.mail.kallo.fit`. If Resend setup added one, **it
   overrides** the apex `sp=` for `mail.kallo.fit`, so stage that record too
   (same steps as §4, its own `p=`).
4. Wait **1–2 weeks** (long enough to see weekly or monthly mail). Pass
   criteria: every source you recognize shows DMARC pass (aligned SPF or DKIM);
   every failing source is either unknown (spoofing, fine to block) or on the
   inventory above and fixed. Also send a test from each real sender and look
   for `dmarc=pass` in the received headers (Gmail: **Show original**).

## 4. Target records and staging

Change one thing at a time and keep watching reports between stages. Each
stage below is the full value of the TXT record at that name.

### Apex SPF — `kallo.fit` TXT

```text
v=spf1 include:_spf.mx.cloudflare.net -all
```

Only the qualifier changes. Before editing, confirm Cloudflare still documents
the same include (**Email → Email Routing → Settings** shows the expected
records; [docs][cf-routing-dns]). Keep exactly **one** `v=spf1` record per name.
If the Email Routing page flags the record as wrong after the edit, restore
Cloudflare's exact value — DMARC is what enforces; `-all` is a secondary
signal.

### Sending subdomain — Resend records

Leave these exactly as Resend's **Domains → mail.kallo.fit → Records** tab
shows them (**copy from dashboard**; the Resend Cloudflare guide shows the
typical shape: `MX send.mail` → `feedback-smtp.<region>.amazonses.com`,
`TXT send.mail` → `v=spf1 include:amazonses.com ~all`, `TXT
resend._domainkey.mail` → the DKIM key; some accounts get CNAMEs instead)
([Resend on Cloudflare][resend-cf], [add a domain][resend-domain]). All must be
**DNS only** (grey cloud). Do not tighten Resend's SPF — it is not what makes
DMARC pass here; the aligned DKIM signature is.

### DMARC — `_dmarc.kallo.fit` TXT

`<rua>` is whatever the record has after §3 (Cloudflare's address, plus yours).

**Every stage from 1 onward can stop legitimate mail from reaching users.**
`p=quarantine` only asks receivers to treat failing mail as suspicious; it does
not promise a visible spam folder. Some receivers (and many corporate gateways)
hold it in an admin quarantine the user never sees, drop it, or bounce it. A
sender you forgot in §2 means missing sign-up and password-reset emails at
stage 1 just as it would at stage 3. So give quarantine the same care as
reject: only advance when §3 is clean, run the whole §5 checklist right after
each change, and have the §6 rollback value ready to paste before you edit.

| Stage | Record value | Hold for |
|---|---|---|
| 0 (today) | `v=DMARC1; p=none; rua=<rua>` | until §3 is clean |
| 1 | `v=DMARC1; p=quarantine; pct=25; sp=quarantine; adkim=r; aspf=r; rua=<rua>` | 1 week |
| 2 | `v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r; rua=<rua>` | 1–2 weeks |
| 3 (target) | `v=DMARC1; p=reject; sp=reject; np=reject; adkim=r; aspf=r; rua=<rua>` | permanent |

Notes on the tags:

- **`pct`** is from the old spec (RFC 7489). The new DMARC standard, RFC 9989
  (May 2026), removed it and added `t=y` ("testing, don't apply") instead
  ([RFC 9989][rfc9989]). Receivers that still honor `pct` sample 25%; ones that
  follow RFC 9989 ignore it and quarantine everything. So treat stage 1 as "full
  quarantine for some receivers", not as a 25% sample — it can already block
  real mail (see above). It is still worth a week because it is the smallest
  step up from `p=none` and the reports show the effect before `p=reject`.
- **`sp=`** covers every *existing* subdomain that has no `_dmarc` record of its
  own, including `mail.kallo.fit` (unless §3 step 3 found one). **`np=`**
  (RFC 9989) covers subdomains that don't exist at all, e.g.
  `billing.kallo.fit`; receivers that don't know it fall back to `sp=`.
- **`adkim=r; aspf=r`** are the defaults, written out for clarity. Resend's
  SPF envelope is `send.mail.kallo.fit`, which aligns only under relaxed, so do
  not set `aspf=s`. `adkim=s` would still pass for our `mail.kallo.fit` mail,
  but buys nothing and breaks any future `From: @kallo.fit` signed by a
  subdomain key.
- **`ruf=`** (per-message failure reports) is omitted on purpose: few receivers
  send them and they can contain message content, i.e. personal data.
- If the apex truly sends nothing (§2), you may apply stage 3 to the apex
  alone sooner by keeping `sp=` one stage behind — e.g.
  `p=reject; sp=quarantine` — while `mail.kallo.fit` finishes staging.

### Hostnames that never send

The apex policy (`sp=` / `np=`) already protects every subdomain. For an
existing hostname that has no CNAME, you can also publish a null SPF so SPF
fails outright: `TXT <name>` → `v=spf1 -all`. `www` is a CNAME, so it cannot
carry a TXT record — `sp=reject` covers it.

### Optional hardening (flagged as absent by the pentest)

- **MTA-STS + TLS-RPT**: make senders require TLS when delivering to our MX,
  and report failures. Needs `_mta-sts` / `_smtp._tls` TXT records plus a policy
  file at `https://mta-sts.kallo.fit/.well-known/mta-sts.txt` (e.g. a Worker).
  Start in `mode: testing`.
- **BIMI** (logo in the inbox): only after `p=quarantine`/`reject`; most
  mailbox providers also want a paid mark certificate. Later, if ever.
- **CAA**: limits which CAs may issue certificates for `kallo.fit`. When you add
  any CAA record, Cloudflare adds the ones Universal SSL needs automatically
  ([CAA records][cf-caa]).
- **DNSSEC**: Cloudflare → **DNS → Settings → Enable DNSSEC**, then paste the DS
  record at Namecheap (algorithm 13 / ECDSA P-256 SHA-256) ([DNSSEC][cf-dnssec]).

## 5. Verification checklist

After every stage:

```bash
dig +short TXT kallo.fit                  # exactly one "v=spf1 ..." record
dig +short TXT _dmarc.kallo.fit           # the stage you just applied
dig +short TXT _dmarc.mail.kallo.fit      # empty, or staged in step with the apex
dig +short TXT send.mail.kallo.fit        # Resend SPF, as the dashboard shows
dig +short TXT resend._domainkey.mail.kallo.fit   # DKIM key present
dig +short MX kallo.fit                   # route1-3.mx.cloudflare.net unchanged
```

- [ ] Trigger each real sender and open the result in Gmail → **Show
      original**: `SPF: PASS`, `DKIM: PASS` with `d=mail.kallo.fit`, `DMARC:
      PASS`. Senders: sign-up confirmation, password reset, email change, and a
      waitlist sign-up.
- [ ] Send one of those to a [mail-tester.com](https://www.mail-tester.com)
      address, and/or to [learndmarc.com](https://www.learndmarc.com), which
      walks through the SPF/DKIM/alignment result step by step.
- [ ] Send a mail *to* `support@kallo.fit` from an outside account and confirm
      it still arrives (inbound routing unaffected).
- [ ] Next days' aggregate reports: no new failing source you recognize.

## 6. Rollback

DNS edits in Cloudflare take effect within minutes (record TTL `Auto`).

- **Legit mail landing in spam, going missing or bouncing**: set
  `_dmarc.kallo.fit` back one stage (worst case to stage 0, `p=none`), and put
  the SPF qualifier back to `~all`. Then find the failing source in the reports and fix *it* (add its
  DKIM, or move it onto `mail.kallo.fit`) before re-tightening.
- **Resend mail failing only**: check the Resend dashboard shows the domain as
  **Verified** and every record green; a proxied (orange) record or a changed
  value is the usual cause.
- **Inbound support mail stops**: MX or apex SPF was changed; restore the
  values Email Routing → Settings lists.

## Current state vs target

| Record | Now (pentest) | Target |
|---|---|---|
| `kallo.fit` SPF | `include:_spf.mx.cloudflare.net ~all` | same include, `-all` |
| `_dmarc.kallo.fit` | `p=none` | `p=reject; sp=reject; np=reject; adkim=r; aspf=r` |
| `rua` reports | set, destination unknown | read in DMARC Management, reviewed each stage |
| `ruf` reports | — | omitted |
| `mail.kallo.fit` SPF/DKIM | Resend-verified | unchanged (copy from dashboard) |
| `_dmarc.mail.kallo.fit` | unknown | absent, or staged to `p=reject` |
| MTA-STS / TLS-RPT | absent | optional |
| CAA / DNSSEC | absent | optional |

## Sources

- Cloudflare, [Email Routing DNS records][cf-routing-dns] and
  [postmaster (SRS, ARC, DKIM)][cf-postmaster]
- Cloudflare, [Enable DMARC Management][cf-dmarc], [CAA records][cf-caa],
  [DNSSEC][cf-dnssec]
- Resend, [Add and verify a domain][resend-domain],
  [Cloudflare DNS guide][resend-cf], [Implementing DMARC][resend-dmarc]
- IETF, [RFC 9989 — DMARC][rfc9989] (replaces RFC 7489; removes `pct`, adds
  `t` and `np`)

[cf-routing-dns]: https://developers.cloudflare.com/email-routing/setup/email-routing-dns-records/
[cf-postmaster]: https://developers.cloudflare.com/email-routing/postmaster/
[cf-dmarc]: https://developers.cloudflare.com/dmarc-management/enable/
[cf-caa]: https://developers.cloudflare.com/ssl/edge-certificates/caa-records/
[cf-dnssec]: https://developers.cloudflare.com/dns/dnssec/
[resend-domain]: https://resend.com/docs/add-a-domain
[resend-cf]: https://resend.com/docs/knowledge-base/cloudflare
[resend-dmarc]: https://resend.com/docs/dashboard/domains/dmarc
[resend-analyzer]: https://resend.com/docs/dmarc-analyzer
[rfc9989]: https://www.rfc-editor.org/rfc/rfc9989.html
