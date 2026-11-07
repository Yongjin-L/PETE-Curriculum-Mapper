# PETE Curriculum Mapper

A free web tool that helps physical education teacher education (PETE) faculty map the SHAPE America 2017 Initial PETE Standards (6 standards, 25 components) onto the courses of their program, for internal program review. Faculty upload their plan of study; AI lists the courses and suggests an initial I/R/M matching, which they review and refine.

Created by [Yongjin Lee](https://yongjin.info) · https://curriculum.yongjin.info

## Status
| Phase | | Status |
|---|---|---|
| 1 | Master data set template + checker | Done |
| 2 | Prototype: courses, drag-and-drop topics, I/R/M levels, custom topics and books, coverage view, browser autosave, JSON open/download | Done |
| 3 | Google sign-in, save/open in Google Drive, sharing, conflict handling | **Done** (needs Google credentials: see [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)) |
| 4 | PDF and Word export (Summary / Standard / Full), JSON backup | **Done** |
| — | Custom domain `curriculum.yongjin.info` | See [docs/CUSTOM_DOMAIN.md](docs/CUSTOM_DOMAIN.md) |
| 5 | AI: plan-of-study upload with review, map analysis (in exports), daily limits | **Done** (needs API key: see [docs/AI_SETUP.md](docs/AI_SETUP.md)) |
| 6 | Launch: anonymous usage statistics (+ private /stats page), help page, feedback link, site icon/sharing preview, security headers | **Done**. Remaining steps: [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) |
| 7 | Simplified to SHAPE standards and components only (textbooks/topics removed); upload-first flow with AI-suggested matching and review; "Suggest matching" for typed courses | **Done** |

See [PLAN.md](PLAN.md) for the full specification.

## Run locally
Requires Node.js 20 or newer.
```bash
npm install
npm run dev
```
Then open http://localhost:3000.

Google sign-in needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` and `NEXT_PUBLIC_GOOGLE_APP_ID` (put them in `.env.local` for local use). Without them, the site works in browser-only mode.

## Update the standards data set
1. Edit `dataset/PETE_dataset_template.xlsx` in Excel or Google Sheets (see [dataset/README.md](dataset/README.md)).
2. Upload it back to the `dataset` folder on GitHub (same file name) and commit.
3. Vercel rebuilds. The data is checked first; if there are errors, the build stops and the build log lists them by tab and row.

## Project layout
```
app/                 Next.js pages and global styles
components/          Mapper (main screen), CourseList, TopicPanel, Coverage, dialogs
lib/                 Types, plan state, data set helpers, Google sign-in, Drive client, merge
docs/                Setup guides
dataset/             The data set workbook (source of truth) and its guide
public/data/         Generated dataset.json loaded by the site
scripts/             Data set checker/converter (runs before every build) and workbook formatter
```
