<p align="center"><img src="logo.svg" width="96" alt="Aevia logo"></p>

<h1 align="center">Aevia</h1>
<p align="center"><i>Your AI Study Planner</i></p>

Aevia turns your subjects, deadlines and exam dates into a day-by-day study plan, and replans when life gets in the way. Built for Tech Day @Amity, Noida (28 Sep 2026).

A deterministic scheduling engine guarantees every plan is valid (it fits your hours and meets every deadline). AI reads what you write, explains the plan and changes its inputs, so if the AI is ever unavailable, the planner keeps working.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Put an AI key in `.env.local` (git-ignored):

```
GROQ_API_KEY=gsk_...           # used first (model: openai/gpt-oss-120b)
# ANTHROPIC_API_KEY=sk-ant-... # fallback provider if no Groq key
```

Without a key, everything except the AI features still works.

## The flow

1. **Landing page** (`/`): animated night-sky hero, an interactive dashboard preview (sample data), features, AI tools and how it works.
2. **Get started**: onboarding questions (what you study, when you focus best, course, semester, subjects, confidence, exam dates, study hours, anything else in your own words).
3. **Save your plan**: showcase sign-in; one click signs you in (no real accounts).
4. **App** (`/app`): Today · Timetable · Subjects · Coach · Insights · More tools.

The original single-file landing page is kept as `index.html` (open it directly in a browser, no build step).

## Features

| Feature | What it does |
|---|---|
| Describe your semester | Plain English → subjects, exams, deadlines, hours, blocked days |
| Automatic timetable | Most urgent work first, weighted by priority, difficulty and confidence; Learn → Practice → Revision the day before each exam |
| Deadline safety | Assignments finish a day early; exam days are half-load; overload is trimmed fairly with warnings |
| Energy-aware | Morning person / night owl, plus a same-day energy check-in: hardest sessions go to your peak hours |
| Today's playlist | Today's sessions as tracks with a focus timer that checks sessions off |
| Plan my day | "I have 2 hours tonight" → today's exact session list |
| Butterfly effect | See what skipping costs before you skip: readiness per subject, lost hours, recovery plan, a note from Future You |
| Teach it back | Explain a topic; AI scores it, finds gaps and misconceptions, and moves weak topics earlier in your plan |
| Why this plan? | AI explains the plan, today's focus, subject tips and burnout risk |
| Replan by chat | "I'm sick on Thursday", "move the OS exam to 15 Oct" |
| Study kit | Any session → minute-by-minute plan, flashcards, practice questions |

### More tools and insights

| Tool | What it does | AI? |
|---|---|---|
| Exam predictor | Likely questions with likelihood %, topic weightage; paste past papers to sharpen it | yes |
| Concept map | Topic prerequisites, root-cause weaknesses, fix-first study order | yes |
| Viva simulator | 5-question adaptive oral exam with follow-ups and a final report | yes |
| Concept pack | 2-minute explainer, analogy, Q&A, problems with hints, flashcards | yes |
| Twist test | Questions in unfamiliar settings, graded on applying the concept | yes |
| Momentum | Streak, completion rate, trend, burnout risk, one-click fixes | no |
| Readiness forecast | 1,000 simulated outcomes per exam: chance of being ready, ±1 h/day comparisons | no |
| Study buddy | Share a code with a friend: who teaches whom, overlapping free time | no |

## Code map

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Landing page |
| `src/app/app/page.tsx` | The app shell and screens |
| `src/app/aevia.css` | The Aevia design system (ported from `index.html`) |
| `src/components/aevia/` | Logo, sky scene, interactive dashboard preview, onboarding |
| `src/components/app/Today.tsx` | The Today dashboard |
| `src/lib/scheduler.ts` | Scheduling engine (no AI) |
| `src/lib/whatif.ts`, `src/lib/analytics.ts` | Butterfly effect, momentum, forecast, study buddy (no AI) |
| `src/lib/ai.ts`, `src/app/api/*` | AI calls with strict JSON schemas (Groq or Claude) |
| `src/lib/usePlanner.ts` | App state (saved in the browser) and every action |

Fonts: Big Shoulders, Playfair Display, Hanken Grotesk and DM Mono (Google Fonts, self-hosted by Next.js).
