# Launch checklist (Phase 6)

Work through this in order. Each item says where to do it. Items marked ✅ are already built into the site.

## A. Content (most important)
- [ ] **Check the standards data.** The site uses the six SHAPE standards and 25 components from the 2017 document, each with a short label for the map. Review the labels in `dataset/PETE_dataset_template.xlsx` (components tab) and change any wording you'd like. See [dataset/README.md](../dataset/README.md).
- [ ] **Try the AI matching with 2–3 real plans of study** (yours and a colleague's) and note how much editing the suggestions needed. That's useful feedback to share with Claude for tuning.
- [ ] Check the SHAPE standard labels in `standards.csv` against SHAPE America's official 2017 document.
- [ ] Read the **Help**, **Privacy** and **Terms** pages (`/help`, `/privacy`, `/terms`) and adjust the wording if you like. Your university may also want to review them.

## B. Address and accounts
- [ ] **curriculum.yongjin.info works:** [CUSTOM_DOMAIN.md](CUSTOM_DOMAIN.md), steps 1–3.
- [ ] **Google sign-in set up** for that address: [GOOGLE_SETUP.md](GOOGLE_SETUP.md), plus step 4 of the domain guide.
- [ ] **AI turned on:** [AI_SETUP.md](AI_SETUP.md), including the Anthropic monthly spend limit.

## C. Usage statistics
✅ Built in: anonymous feature counts (maps started, courses added, components placed, AI suggestions accepted, exports, sign-ins, AI use) and an estimate of distinct institutions. University names are stored only as one-way codes. No cookies.

- [ ] **Turn on page-view statistics:** Vercel → project → **Analytics** tab → **Enable** (Web Analytics; the free plan includes a monthly allowance).
- [ ] **Make your private statistics link:** Vercel → Settings → Environment Variables → add `STATS_KEY` = a long random phrase only you know, for example four random words and a number, then redeploy.
  Your statistics page is then `https://curriculum.yongjin.info/stats?key=YOUR-PHRASE`. Bookmark it, and don't share it.
- Feature counts are stored in the Upstash database from the AI setup, so they start once Upstash is connected.

## D. Feedback link
✅ "Feedback" appears in the footer and on the Help page. Until you set it, it points to yongjin.info.
- [ ] Create a **Google Form** (forms.google.com), for example "PETE Curriculum Mapper feedback". Suggested questions:
  1. Your role (faculty / program coordinator / student / other)
  2. What were you trying to do?
  3. What worked well?
  4. What was confusing or didn't work? (include the browser, if relevant)
  5. How accurate was the AI-suggested matching for your program?
  6. May we contact you? (optional email)
- [ ] Copy the form's **Send → link** and add it in Vercel as `NEXT_PUBLIC_FEEDBACK_URL`, then redeploy.

## E. Make Google sign-in public
While the app is in **Testing**, only test users can sign in. To open it to all faculty:
1. [ ] **Search Console:** verify you own `yongjin.info` ([CUSTOM_DOMAIN.md](CUSTOM_DOMAIN.md), step 5).
2. [ ] **Google Auth Platform → Branding:** the app name, support email, home page `https://curriculum.yongjin.info`, privacy and terms links, and authorized domain `yongjin.info` are all filled in. A logo is optional; adding one triggers brand review.
3. [ ] **Google Auth Platform → Audience → Publish app** (moves it from Testing to In production).
4. [ ] If Google asks for **brand verification**, use **Verification Center → Submit**. The site only uses non-sensitive permissions (`openid`, `email`, `profile`, `drive.file`), so no security assessment or demo video should be needed. Reviews usually take a few business days; Google emails your support address with any questions.
5. [ ] Afterwards, sign in with an account that was **not** a test user to confirm there's no "unverified app" warning.

## F. Final checks (about 20 minutes)
On the real site, ideally on two computers or a computer and a phone:
- [ ] Without signing in: add courses (type and paste), place components, change levels, reload the page. The work is still there.
- [ ] Sign in → **Save to Drive** → the file appears in Google Drive → **PETE Curriculum Mapper** folder.
- [ ] Share the file with a colleague. They open it via **My maps → Open a map shared with me…**, make a change, and you see it within about a minute.
- [ ] Both of you edit at the same time → the "changed by someone else" dialog appears → **Keep both** keeps both changes.
- [ ] **Upload plan of study (AI)** with a real PDF from your program → review → confirm.
- [ ] **Coverage → Analyze my map** → **Export → Full** as PDF and Word. Open both.
- [ ] **Export → JSON**, then **New map**, then **Open JSON**: the map comes back.
- [ ] Your `/stats?key=…` page shows the counts going up after a minute or so.

## G. Pilot with faculty (suggested)
1. **Invite 3–5 PETE programs.** Colleagues from conferences such as SHAPE America or AIESEP are good candidates. If Google sign-in isn't public yet, add them as test users.
2. **Give them a short task list:** "Upload your plan of study, review the suggested matching, refine it, export a Full PDF, and send feedback."
3. **Run it for 2–3 weeks**, then review the feedback form and the `/stats` page.
4. **Adjust labels or the AI matching guidance** based on the pilot, then announce the tool more widely.
