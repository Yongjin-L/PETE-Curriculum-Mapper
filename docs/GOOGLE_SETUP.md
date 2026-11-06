# Google sign-in and Drive: one-time setup

This takes about 20–30 minutes. You create a Google Cloud project, which gives the site three values. Then you paste those values into Vercel.

Throughout, replace **`https://YOUR-SITE.vercel.app`** with your site's real address (Vercel → your project → **Domains**).

---

## 1. Create a Google Cloud project
1. Go to **https://console.cloud.google.com** and sign in. A personal Gmail account is the safest choice, because some university Workspace accounts block creating projects.
2. Click the project picker at the top → **New project**.
3. Name it **PETE Curriculum Mapper** → **Create**, then make sure it is selected in the project picker.

## 2. Turn on the two APIs
1. Menu ☰ → **APIs & Services → Library**.
2. Search **Google Drive API** → **Enable**.
3. Go back to the Library, search **Google Picker API** → **Enable**.

## 3. Set up the consent screen (what users see when they sign in)
1. Menu ☰ → **Google Auth Platform** (in older consoles: **APIs & Services → OAuth consent screen**) → **Get started**.
2. **App information:** App name `PETE Curriculum Mapper`, and your support email.
3. **Audience:** choose **External**.
4. **Contact information:** your email → agree → **Create**.
5. **Branding** (left menu):
   - Application home page: `https://YOUR-SITE.vercel.app`
   - Privacy policy: `https://YOUR-SITE.vercel.app/privacy`
   - Terms of service: `https://YOUR-SITE.vercel.app/terms`
   - Save. (Authorized domains can wait until you have a custom domain; see the note at the end.)
6. **Data access** → **Add or remove scopes**, and tick:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `.../auth/drive.file` (search "drive.file"; its description is "See, edit, create, and delete only the specific Google Drive files you use with this app")
   - **Update** → **Save**.
7. **Audience** → **Test users** → **Add users**: add your own Google address and any colleagues who will pilot the tool (up to 100).
   While the app is in **Testing**, only these people can sign in, and they will see a "Google hasn't verified this app" notice. They click **Continue**. That notice goes away after verification in Phase 6.

## 4. Create the OAuth client ID  → value 1
1. Google Auth Platform → **Clients** → **Create client**.
2. Application type: **Web application**. Name: `PETE Curriculum Mapper web`.
3. **Authorized JavaScript origins** → add:
   - `https://YOUR-SITE.vercel.app`
   - `http://localhost:3000` (for local testing)
4. Leave **Authorized redirect URIs** empty → **Create**.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). You don't need the client secret.

## 5. Create an API key for the file picker  → value 2
1. Menu ☰ → **APIs & Services → Credentials** → **Create credentials → API key**. Copy the key.
2. Click the new key, or **Edit API key**, to restrict it:
   - **Application restrictions:** Websites → add `https://YOUR-SITE.vercel.app/*` and `http://localhost:3000/*`
   - **API restrictions:** Restrict key → select **Google Picker API** only
   - **Save**.

## 6. Find the project number  → value 3
Menu ☰ → **IAM & Admin → Settings** (or the project **Dashboard**) → copy the **Project number**. It is all digits; the project *ID* is something different.

## 7. Add the values to Vercel
1. Vercel → your project → **Settings → Environment Variables**.
2. Add each of these, with **Production** and **Preview** both ticked:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | value 1 (Client ID) |
   | `NEXT_PUBLIC_GOOGLE_API_KEY` | value 2 (API key) |
   | `NEXT_PUBLIC_GOOGLE_APP_ID` | value 3 (project number) |

3. These values are read when the site is built, so **redeploy**: **Deployments** → ⋯ on the latest deployment → **Redeploy**.

These three values are safe to be public. Google protects them with the origins and website restrictions you set above, and they are not passwords. Still, keep them in Vercel rather than in the code.

## 8. Try it
1. Open the site. The top bar should show **Sign in to save to Drive**.
2. Sign in with a test-user account → choose **Save current map to Drive**.
3. In Google Drive, a folder **PETE Curriculum Mapper** now holds your map file.
4. To test sharing: share that file (Drive → Share) with a second test user. That person signs in on the site → account menu → **My maps in Drive…** → **Open a map shared with me…** → picks the file.

### If something goes wrong
| Message | Fix |
|---|---|
| "Access blocked: … has not completed the Google verification process" | Add that Google account as a **Test user** (step 3.7). |
| "Error 400: origin_mismatch" / "redirect_uri_mismatch" | The site's exact address (including `https://`, no trailing slash) is missing from **Authorized JavaScript origins** (step 4.3). |
| The sign-in button doesn't appear | The environment variables are missing, or the site wasn't redeployed after adding them (step 7). |
| "Open a map shared with me…" is missing | `NEXT_PUBLIC_GOOGLE_API_KEY` or `NEXT_PUBLIC_GOOGLE_APP_ID` isn't set. |
| The picker shows an error | The API key's website restriction doesn't include the site, or the Picker API isn't enabled (steps 2 and 5). |

---

**Note for Phase 6 (going public):** Google's verification requires a domain you own. A `vercel.app` address can't be verified, so connect your custom domain first, then add it to Branding → Authorized domains, the client's JavaScript origins and the API key's websites, and submit for verification. The `drive.file` permission is "non-sensitive", so the review is light: brand verification only, with no security assessment.
