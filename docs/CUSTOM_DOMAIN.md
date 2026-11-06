# Using curriculum.yongjin.info (GoDaddy + Vercel)

You'll add the address in Vercel, then add one DNS record in GoDaddy. Your main site at `yongjin.info` isn't affected; this only creates the `curriculum.` subdomain.

## 1. Add the domain in Vercel
1. Go to **vercel.com** → your **PETE Curriculum Mapper** project → **Settings → Domains**.
2. Type `curriculum.yongjin.info` → **Add**. If Vercel asks which environment, choose **Production**.
3. Vercel shows **Invalid Configuration** and the record it needs, something like:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `curriculum` | `cname.vercel-dns.com` *(or a project-specific value such as `abc123.vercel-dns-017.com`)* |

   **Copy the exact Value Vercel shows you.** Keep this tab open.

   If Vercel instead asks for a **TXT** record named `_vercel`, add that too in step 2. It appears when the domain was used before in another Vercel account.

## 2. Add the record in GoDaddy
1. Sign in at **godaddy.com** → your name (top right) → **My Products**.
2. Next to **yongjin.info**, click **DNS** (or **Manage DNS**).
3. Look through the existing records. If there is already a record named `curriculum`, delete it first (⋯ → Delete).
4. Click **Add New Record**:
   - **Type:** `CNAME`
   - **Name:** `curriculum` (just that word, not the full address)
   - **Value:** the value you copied from Vercel. If GoDaddy adds a trailing dot, that's fine.
   - **TTL:** 1 Hour (default)
5. **Save**.

> **If GoDaddy says your DNS is managed elsewhere** (for example, the nameservers point to Cloudflare or another host), add the same CNAME record there instead. GoDaddy only controls DNS when the nameservers are GoDaddy's (`nsXX.domaincontrol.com`).

## 3. Wait and confirm
- Go back to Vercel → **Domains**. Within a few minutes (occasionally up to an hour or two) the status changes to **Valid Configuration**. Vercel then issues the HTTPS certificate automatically.
- Open **https://curriculum.yongjin.info**. You should see the site.
- Optional: in Vercel → Domains, you can set your `*.vercel.app` address to **redirect** to `curriculum.yongjin.info`, so everyone uses one address. This also matters for Google sign-in, which only works on the addresses you list.

## 4. Point Google sign-in at the new address
Google sign-in only works on addresses you have listed. In **console.cloud.google.com** (project *PETE Curriculum Mapper*):

1. **Google Auth Platform → Clients** → your web client → **Authorized JavaScript origins** → add `https://curriculum.yongjin.info` → **Save**. Keep the `vercel.app` entry until the redirect from step 3 is in place.
2. **APIs & Services → Credentials** → your API key → **Website restrictions** → add `https://curriculum.yongjin.info/*` → **Save**.
3. **Google Auth Platform → Branding**:
   - Home page `https://curriculum.yongjin.info`, Privacy `https://curriculum.yongjin.info/privacy`, Terms `https://curriculum.yongjin.info/terms`
   - **Authorized domains** → add `yongjin.info` → **Save**.

Changes can take 5 minutes, sometimes longer, to apply. Then test signing in at the new address.

## 5. Prove you own yongjin.info (needed for Google verification later)
Do this once, before submitting the app for verification in Phase 6:
1. Go to **search.google.com/search-console** → **Add property** → choose **Domain** → enter `yongjin.info`.
2. Google shows a **TXT** record (it starts with `google-site-verification=`). Copy it.
3. In GoDaddy DNS for yongjin.info → **Add New Record** → Type `TXT`, Name `@`, Value = the copied text → **Save**.
4. Back in Search Console, click **Verify**. It may take a few minutes.

Use the same Google account that owns the Google Cloud project.
