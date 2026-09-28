# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

College students (B.Tech, BBA, BCA and similar programmes) juggling subjects, labs, assignments and mid-sem/end-sem exams alongside personal commitments. They open the planner to know what to study today, and return when plans change (illness, events, a moved exam).

## Product Purpose

An AI study planner that turns a student's courses, exam dates, deadlines and free hours into a personalised timetable, then keeps it realistic as life changes. Built for Tech Day @Amity, Noida (TCS–Amity problem statement "AI Study Planner", 28 Sep 2026). Success in the demo: a judge sees a student describe their semester and get a clean, trustworthy plan within a minute, then watch it adapt.

## Positioning

A deterministic scheduling engine guarantees every timetable is valid (deadlines met, revision before exams, daily hours respected); AI only understands language, explains, and adjusts inputs. Signature mechanisms: the Butterfly Effect (see the future cost of skipping before you skip) and Teach It Back (your explanation of a topic reshapes your timetable).

## Operating Context

Demoed live on localhost to hackathon judges on a laptop. Flow: landing page → scroll into personalisation questions (course, semester, subjects, exams, hours) → showcase sign-in (one click signs in; no real auth) → the app. Groq API (`openai/gpt-oss-120b`) powers AI features via `GROQ_API_KEY`.

## Capabilities and Constraints

- Core navigation (confirmed): five core screens (Today, Timetable, Subjects, Coach, Insights) plus one "More tools" screen for advanced features; everything must be very simple to use.
- Existing capabilities: natural-language semester parsing, timetable engine, Plan my day, Butterfly effect, Teach it back, Study kit, replan-by-chat, Why this plan, Exam predictor, Concept map, Viva simulator, Concept pack, Twist test, Momentum, Readiness forecast, Study buddy, focus timer.
- Sign-in is a showcase only: clicking it signs in immediately; no accounts, passwords or backend.
- Data lives in the browser (localStorage); no database.

## Brand Commitments

- The visual design, layout and animations must replicate the UI in the user's repository https://github.com/MahatvaGoell/Aevia exactly ("ditto same"). The previous brown dark-academia look is discarded.
- Palette direction from the user: golden, beige, black.
- Product name: to be taken from the Aevia UI (open until the repository is available).

## Evidence on Hand

No testimonials, user counts, partner logos or metrics exist. Do not fabricate them; the demo student ("Aarav", B.Tech) is synthetic and must stay labelled as a demo.

## Product Principles

1. The plan must always be valid; AI failure degrades to the engine, never to a broken screen.
2. One clear next action per screen: the student should never wonder what to do now.
3. Show consequences, not just schedules: readiness, cost of skipping, what changed and why.
4. Simplicity over feature count: advanced tools stay one click away, never in the way.
