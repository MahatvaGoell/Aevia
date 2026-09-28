<p align="center"><img src="logo.svg" width="96" alt="Aevia logo"></p>

<h1 align="center">Aevia</h1>
<p align="center"><i>Your AI Study Planner</i></p>

Landing page for Aevia. Aevia turns your subjects, deadlines and exam dates into a day-by-day study plan, and replans when life gets in the way.

## Run it

It's one static page with no build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## What's on the page

- **Hero:** an animated night-sky window with a live focus timer
- **Dashboard preview:** today's playlist, % ready per subject, weekly hours, deadlines and the tip of the day (sample data)
- **Features:** weekly timetable, today's playlist, subjects, deadlines, tips and alerts, replan by chat
- **AI tools:** Plan my day, Butterfly effect, Teach it back, Why this plan?
- **How it works**, plus two onboarding questions

## Files

| File | What it is |
|---|---|
| `index.html` | The whole page: HTML, CSS and JS |
| `logo.svg` | The Aevia mark, also used as the favicon |

Fonts load from Google Fonts: Big Shoulders Display, Playfair Display, Hanken Grotesk and DM Mono.
