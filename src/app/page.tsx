"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoDashboard } from "@/components/aevia/DemoDashboard";
import { Arrow, Mark } from "@/components/aevia/Mark";
import { Onboarding } from "@/components/aevia/Onboarding";
import { SkyScene } from "@/components/aevia/SkyScene";
import { readSession } from "@/lib/usePlanner";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Landing() {
  // focus timer shared by the hero pill and the playlist chip
  const [left, setLeft] = useState(25 * 60);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => (l > 0 ? l - 1 : 25 * 60)), 1000);
    const read = () => setSignedIn(!!readSession()?.signedIn);
    const r = setTimeout(read, 0);
    return () => {
      clearInterval(t);
      clearTimeout(r);
    };
  }, []);

  return (
    <div className="ae lp">
      <div className="wrap">
        <nav aria-label="Main">
          <a className="logo" href="#top" aria-label="Aevia home">
            <Mark id="lg" />
            <span>Aevia</span>
          </a>
          <div className="links">
            <a href="#preview">Dashboard</a>
            <a href="#features">Features</a>
            <a href="#tools">AI tools</a>
            <a href="#how">How it works</a>
            {signedIn ? (
              <Link className="btn" href="/app">
                Open my plan
              </Link>
            ) : (
              <a className="btn" href="#start">
                Start planning
              </a>
            )}
          </div>
        </nav>

        <header id="top">
          <div className="window">
            <SkyScene />
            <div className="km">
              <i />
              <span>FOCUS {fmt(left)} · DBMS · SESSION 2 OF 4</span>
            </div>
            <div className="hero-copy">
              <h1>
                Your semester, <span className="gold">sorted.</span>
              </h1>
              <div className="hero-side">
                <p>Aevia turns your subjects, deadlines and exam dates into a day-by-day study plan. When life gets in the way, it replans in seconds and shows you what changed.</p>
                <a className="btn" href="#start">
                  Build my study plan <Arrow />
                </a>
              </div>
            </div>
          </div>
        </header>

        <section id="preview">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Your dashboard</span>
              <h2>
                Everything for today, <span className="gold">on one screen</span>
              </h2>
            </div>
            <p>Your sessions, how ready you are for each exam, and what&apos;s due next. Open Aevia, press play on the first session, and start.</p>
          </div>

          <DemoDashboard />
        </section>

        <section id="features">
          <div className="sec-head">
            <div>
              <span className="eyebrow">What&apos;s inside</span>
              <h2>
                A planner that knows <span className="gold">what&apos;s due</span>
              </h2>
            </div>
            <p>Tell Aevia about your semester once. It keeps track of the rest.</p>
          </div>
          <div className="feats">
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <rect x="3" y="4" width="20" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 10h20M9 2v4M17 2v4" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <h3>Weekly timetable</h3>
              <p>Built for you from your exams and deadlines. Subjects are mixed each day, and the day before every exam is kept for revision.</p>
            </div>
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 9l6 4-6 4z" fill="currentColor" />
              </svg>
              <h3>Today&apos;s playlist</h3>
              <p>Today&apos;s sessions play like tracks. Start the focus timer, and the session checks itself off when the time is up.</p>
            </div>
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <path d="M4 20h18" stroke="currentColor" strokeWidth="1.6" />
                <rect x="4" y="12" width="4" height="6" rx="1" fill="currentColor" />
                <rect x="11" y="7" width="4" height="11" rx="1" fill="currentColor" />
                <rect x="18" y="4" width="4" height="14" rx="1" fill="currentColor" />
              </svg>
              <h3>Subjects and % ready</h3>
              <p>Each subject shows a countdown to its exam and how ready you are, based on what you&apos;ve finished and how confident you feel.</p>
            </div>
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <path d="M5 7h16M5 13h16M5 19h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="21" cy="19" r="2.5" fill="currentColor" />
              </svg>
              <h3>Deadlines</h3>
              <p>Assignments with priority and status: to do, in progress, done or overdue. Lab reports get finished a day early.</p>
            </div>
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <path d="M13 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 13 3zM10 22h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <h3>Tips and alerts</h3>
              <p>A daily tip based on your plan, plus a warning when you&apos;re short on prep time or studying too many hours in a row.</p>
            </div>
            <div className="feat">
              <svg viewBox="0 0 26 26" aria-hidden="true">
                <path d="M4 6h18v11H11l-5 4v-4H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <h3>Replan by chat</h3>
              <p>Type “I&apos;m sick on Thursday” and your week is rebuilt around it. Aevia moves the sessions, not your exam dates.</p>
            </div>
          </div>
        </section>

        <section id="tools">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Four AI tools</span>
              <h2>
                Ask your plan <span className="gold">anything</span>
              </h2>
            </div>
            <p>Each tool works on your real plan, so every answer is about your subjects and your week.</p>
          </div>
          <div className="tools">
            <article className="tool">
              <div className="tool-top">
                <h3>Plan my day</h3>
                <span className="eyebrow">Tool 1</span>
              </div>
              <p>Tell it how much time you actually have. You get the exact sessions that matter most.</p>
              <div className="ask">I only have 2 hours tonight</div>
              <div className="ans">
                <div className="row">
                  <span>19:00 · 50 min</span>
                  <span>DBMS · Normalization to 3NF</span>
                </div>
                <div className="row">
                  <span>19:55 · 45 min</span>
                  <span>OS · Deadlocks and Banker&apos;s algorithm</span>
                </div>
                <div className="row">
                  <span>20:45 · 20 min</span>
                  <span>Flashcard recap of both</span>
                </div>
              </div>
            </article>
            <article className="tool star">
              <div className="tool-top">
                <h3>Butterfly effect</h3>
                <span className="eyebrow">Tool 2</span>
              </div>
              <p>See what skipping a day costs before you decide. Other planners reschedule after you miss a day. Aevia shows you the result first.</p>
              <div className="ask">Skip today</div>
              <div className="delta">
                <div>
                  <b>
                    <s>59% →</s> 55%
                  </b>
                  <small>Exam readiness</small>
                </div>
                <div>
                  <b>2 h 30 min</b>
                  <small>Study time lost</small>
                </div>
                <div>
                  <b>+25 min</b>
                  <small>Extra per day to recover</small>
                </div>
              </div>
              <p className="note">Future you, Thursday night: “Glad you did the joins today. The OS paper had three of them.”</p>
            </article>
            <article className="tool star">
              <div className="tool-top">
                <h3>Teach it back</h3>
                <span className="eyebrow">Tool 3</span>
              </div>
              <p>Explain a topic in your own words. Aevia scores it, points out what you got wrong, and moves weak topics earlier in your plan.</p>
              <div className="score">
                <b className="gold">45</b>
                <small>/ 100 · Normalization</small>
              </div>
              <div className="flag">
                <span>
                  <s>“Normalization makes queries faster.”</s>
                </span>
                <span>It reduces duplicate data. The extra joins can make some reads slower.</span>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Plan updated: Normalization moved to tomorrow, 18:00.</p>
            </article>
            <article className="tool">
              <div className="tool-top">
                <h3>Why this plan?</h3>
                <span className="eyebrow">Tool 4</span>
              </div>
              <p>Every session has a reason. Ask for it and Aevia explains it in plain words.</p>
              <div className="ask">Why is OS first on Monday?</div>
              <div className="ans">
                <div className="row">
                  <span>Exam</span>
                  <span>In 6 days, the closest one</span>
                </div>
                <div className="row">
                  <span>Confidence</span>
                  <span>2 out of 5, your lowest</span>
                </div>
                <div className="row">
                  <span>Syllabus left</span>
                  <span>40%, about 7 hours of work</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="how">
          <div className="sec-head">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>
                From a paragraph to <span className="gold">a full plan</span>
              </h2>
            </div>
          </div>
          <div className="how">
            <div>
              <span className="t">Step 1</span>
              <h3>Describe your semester</h3>
              <p>Write it the way you&apos;d tell a friend: “DBMS exam on the 7th, OS lab due this Friday, I&apos;m a night owl.” Aevia fills in your dashboard.</p>
            </div>
            <div>
              <span className="t">Step 2</span>
              <h3>Get a timetable</h3>
              <p>The planner builds your week, putting the most urgent work first and weighting each subject by priority, difficulty and confidence.</p>
            </div>
            <div>
              <span className="t">Step 3</span>
              <h3>Adjust as you go</h3>
              <p>Mark sessions done, teach topics back, or tell it about a bad day. Your plan updates and shows you exactly what moved.</p>
            </div>
          </div>
          <div className="trust">
            <h3>Is the AI just making up a schedule?</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p>
                <b>No.</b> A scheduling engine builds the timetable, so every plan fits your hours and meets every deadline. The AI reads what you write, explains the plan and changes its inputs.
              </p>
              <p>If the AI is ever unavailable, your planner keeps working.</p>
            </div>
          </div>
        </section>

        <Onboarding />

        <footer>
          <div className="brand">
            <Mark id="lg2" />
            <div>
              <b>Aevia</b>
              <small>Your AI Study Planner</small>
            </div>
          </div>
          <span>© 2026 Aevia · Plan the semester. Then study it.</span>
        </footer>
      </div>
    </div>
  );
}
