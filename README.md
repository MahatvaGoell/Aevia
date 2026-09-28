# Study Space: AI Study Planner

Tech Day @Amity, Noida (28 Sep 2026)

An AI study planner that **builds, explains and adapts** a student's timetable.
A deterministic scheduling engine guarantees a valid plan; AI makes it personal.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:3000
```

AI key goes in `app/.env.local` (git-ignored):

```
GROQ_API_KEY=gsk_...          # used first (model: openai/gpt-oss-120b)
# ANTHROPIC_API_KEY=sk-ant-... # fallback provider if no Groq key
```

Without a key everything except the AI features still works.

## Features

| Feature | What it does |
|---|---|
| Describe your semester | Plain English → subjects, exams, deadlines, hours, blocked days |
| Automatic timetable | Least-slack-first engine: urgency × priority × difficulty × low confidence; Learn → Practice → Revision the day before each exam |
| Deadline safety | Assignments finish a day early; exam days are half-load; overload is trimmed fairly with warnings |
| Energy-aware | Morning person / night owl: hardest sessions go to your peak hours |
| Plan my day | "I have 2.5 hours from 6:30pm" → today's exact session list |
| Butterfly effect | Simulate "skip today" before you skip: readiness % per subject, lost hours, recovery plan, and a note from Future You |
| Teach it back | Explain a topic; AI scores understanding, finds gaps and misconceptions; your confidence and topic order update, so the timetable changes |
| Study kit | Any session → minute-by-minute plan, flashcards, practice questions |
| Replan by chat | "I'm sick on Thursday", "move OS exam to 15 Oct" |
| Why this plan? | AI explains the plan, today's focus, subject tips, burnout risk |
| Today's playlist | Today's sessions as a playlist with a focus timer that auto-checks sessions off |

## Labs

| Lab | What it does | AI? |
|---|---|---|
| Energy check-in (in Plan my day) | Low energy → ease in with light sessions; high → hardest first | no |
| Exam predictor | Likely questions with likelihood %, topic weightage; paste past papers to sharpen; reorders your sessions | yes |
| Concept map | Topic prerequisites, root-cause weaknesses, fix-first study order; applies to your plan | yes |
| Viva simulator | 5-question adaptive oral exam with follow-ups and a final report; updates confidence | yes |
| Concept pack | 2-min explainer script, analogy, Q&A, problems with hints, flashcards, explanation checklist | yes |
| Twist test | 3 questions in unfamiliar settings, graded on concept transfer; updates confidence | yes |
| Momentum | Streak, completion rate, trend, burnout risk, one-click fixes (lighten a day, rest day, right-size weekdays) | no |
| Readiness forecast | 1,000 simulated futures per exam: chance of being exam-ready, P10–P90 range, +1h/−1h per day comparisons | no |
| Study buddy | Share a code (no server); who teaches whom, overlapping free slots; sample classmate to try it solo | no |

## Architecture

- `src/lib/scheduler.ts`: the engine (pure TypeScript, no AI)
- `src/lib/whatif.ts`: counterfactual plan diff for the Butterfly effect
- `src/lib/ai.ts`: one `structured()` call with strict JSON schemas (Groq or Claude)
- `src/lib/analytics.ts`: momentum, Monte Carlo readiness forecast, study-buddy codes (no AI)
- `src/app/api/*`: parse · adjust · insights · future-self · teach-back · study-kit · predict · concept-map · viva · concept-pack · twist
- `src/components/`: Sidebar, Subjects, Deadlines, WeekGrid, Tools, Labs, Assistant, ui
- `src/lib/usePlanner.ts`: state (localStorage) and every action
- The AI never writes the timetable. It only edits inputs, so every plan is valid by construction.
