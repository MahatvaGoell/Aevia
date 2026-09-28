"use client";

import { BookOpen, CalendarDays, Home, LineChart, LogOut, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Today } from "@/components/app/Today";
import { Mark } from "@/components/aevia/Mark";
import { Deadlines } from "@/components/Deadlines";
import { ForecastView, LabCards, LabModal, MomentumView, type LabId } from "@/components/Labs";
import { SubjectCards } from "@/components/Subjects";
import { ButterflyModal, InsightsModal, PlanMyDayModal, TeachBackModal, type ToolId } from "@/components/Tools";
import { SessionModal, WeekGrid } from "@/components/WeekGrid";
import type { Session } from "@/lib/types";
import { usePlanner } from "@/lib/usePlanner";

type Screen = "today" | "timetable" | "subjects" | "coach" | "insights" | "more";

const NAV: { id: Screen; label: string; icon: typeof Home; title: string; sub: string }[] = [
  { id: "today", label: "Today", icon: Home, title: "Today", sub: "Your sessions, how ready you are for each exam, and what's due next." },
  { id: "timetable", label: "Timetable", icon: CalendarDays, title: "Timetable", sub: "Your week, built from your exams and deadlines. Click any session to open it." },
  { id: "subjects", label: "Subjects", icon: BookOpen, title: "Subjects", sub: "Tap a subject to edit its exam date, confidence and topics. The plan rebuilds instantly." },
  { id: "coach", label: "Coach", icon: Wand2, title: "Coach", sub: "Four AI tools that work on your real plan." },
  { id: "insights", label: "Insights", icon: LineChart, title: "Insights", sub: "Your pace, your streak, and your odds of being exam-ready." },
  { id: "more", label: "More tools", icon: Sparkles, title: "More tools", sub: "Extra ways to prepare: predict the paper, find weak foundations, practise a viva." },
];

const COACH: { id: ToolId; title: string; text: string; ask: string; star?: boolean }[] = [
  { id: "day", title: "Plan my day", text: "Tell it how much time you actually have. You get the exact sessions that matter most.", ask: "I only have 2 hours tonight" },
  { id: "butterfly", title: "Butterfly effect", text: "See what skipping a day costs before you decide. Aevia shows you the result first.", ask: "Skip today", star: true },
  { id: "teach", title: "Teach it back", text: "Explain a topic in your own words. Aevia scores it, points out what you got wrong, and moves weak topics earlier.", ask: "Normalization is when we…", star: true },
  { id: "why", title: "Why this plan?", text: "Every session has a reason. Ask for it and Aevia explains it in plain words.", ask: "Why is this subject first today?" },
];

export default function AppPage() {
  const p = usePlanner();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("today");
  const [tool, setTool] = useState<ToolId | null>(null);
  const [lab, setLab] = useState<LabId | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teachInit, setTeachInit] = useState<{ subjectId: string; topic: string } | undefined>();

  // showcase auth: without a session, go back to the landing page's onboarding
  useEffect(() => {
    if (p.hydrated && !p.signedIn) router.replace("/#start");
  }, [p.hydrated, p.signedIn, router]);

  if (!p.hydrated || !p.signedIn) return <div className="app" style={{ background: "var(--bg)" }} />;

  const nav = NAV.find((n) => n.id === screen)!;
  const openTool = (t: ToolId) => {
    setTeachInit(undefined);
    setTool(t);
  };

  return (
    <div className="ae app">
      <aside className="side">
        <Link className="logo" href="/" aria-label="Aevia home">
          <Mark id="lg-app" />
          <span>Aevia</span>
        </Link>
        <nav className="nav-list" aria-label="App">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className="nav-item" aria-current={screen === id ? "page" : undefined} onClick={() => setScreen(id)}>
              <Icon /> {label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div>
            <b>{p.input.studentName || "Student"}</b>
            <small style={{ display: "block" }}>{p.input.subjects.length} SUBJECTS · SIGNED IN</small>
          </div>
          <button
            className="nav-item"
            style={{ padding: "8px 0" }}
            onClick={() => {
              p.signOut();
              router.push("/");
            }}
          >
            <LogOut /> Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <span className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            <h1>{screen === "today" ? <>Today</> : nav.title}</h1>
            <p>{nav.sub}</p>
          </div>
          {screen === "timetable" && (
            <button className="btn" onClick={() => openTool("day")}>
              Plan my day
            </button>
          )}
          {screen === "subjects" && (
            <button className="btn" onClick={() => document.getElementById("add-subject")?.click()}>
              Add a subject
            </button>
          )}
        </div>

        {screen === "today" && <Today p={p} onOpenSession={setSession} onWhy={() => openTool("why")} />}

        {screen === "timetable" && <WeekGrid p={p} onOpenSession={setSession} hideTitle />}

        {screen === "subjects" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <SubjectCards p={p} hideTitle />
            <Deadlines p={p} />
          </div>
        )}

        {screen === "coach" && (
          <div className="tools">
            {COACH.map((c, i) => (
              <article key={c.id} className={`tool ${c.star ? "star" : ""}`}>
                <div className="tool-top">
                  <h3>{c.title}</h3>
                  <span className="eyebrow">Tool {i + 1}</span>
                </div>
                <p>{c.text}</p>
                <button className="ask" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => openTool(c.id)}>
                  {c.ask}
                </button>
                <button className="btn" onClick={() => openTool(c.id)}>
                  Open {c.title.toLowerCase()}
                </button>
              </article>
            ))}
          </div>
        )}

        {screen === "insights" && (
          <div className="dash">
            <div className="tile c12">
              <h4>Momentum</h4>
              <MomentumView p={p} />
            </div>
            <div className="tile c12">
              <h4>Readiness forecast</h4>
              <ForecastView p={p} />
            </div>
          </div>
        )}

        {screen === "more" && <LabCards onOpen={setLab} only={["predict", "map", "viva", "pack", "twist", "buddy"]} />}
      </main>

      {tool === "day" && <PlanMyDayModal p={p} onClose={() => setTool(null)} />}
      {tool === "butterfly" && <ButterflyModal p={p} onClose={() => setTool(null)} />}
      {tool === "teach" && <TeachBackModal p={p} init={teachInit} onClose={() => setTool(null)} />}
      {tool === "why" && <InsightsModal p={p} onClose={() => setTool(null)} />}
      {lab && <LabModal id={lab} p={p} onClose={() => setLab(null)} />}
      {session && (
        <SessionModal
          p={p}
          session={session}
          onClose={() => setSession(null)}
          onTeachBack={(subjectId, topic) => {
            setSession(null);
            setTeachInit({ subjectId, topic });
            setTool("teach");
          }}
        />
      )}
    </div>
  );
}
