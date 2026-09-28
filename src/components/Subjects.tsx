"use client";

import { BookOpen, Brain, Calculator, FlaskConical, Globe, Landmark, Leaf, Network, PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SUBJECT_COLORS } from "@/lib/demo";
import { daysBetween } from "@/lib/scheduler";
import type { Planner } from "@/lib/usePlanner";
import type { Level, Subject } from "@/lib/types";
import { readiness } from "@/lib/whatif";
import { fmtDate, LevelPicker, Modal, pct } from "./ui";

const ICONS = [BookOpen, Landmark, Network, Calculator, Globe, PenLine, FlaskConical, Brain, Leaf];

export function SubjectCards({ p, hideTitle }: { p: Planner; hideTitle?: boolean }) {
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  return (
    <section id="subjects" className="scroll-mt-6">
      {!hideTitle && <h2 className="section-title mb-3">My subjects</h2>}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {p.input.subjects.map((s, i) => {
          const Icon = ICONS[i % ICONS.length];
          const exam = p.input.exams.filter((e) => e.subjectId === s.id && daysBetween(p.today, e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
          const stat = p.plan.stats.find((x) => x.subjectId === s.id);
          const ready = stat ? readiness(stat) : 0;
          const days = exam ? daysBetween(p.today, exam.date) : null;
          return (
            <button key={s.id} onClick={() => setEditing(s)} className="tile text-left transition-colors hover:border-[var(--line-2)]" style={{ minHeight: 190 }}>
              <span className="flex items-center justify-between">
                <Icon size={20} style={{ color: s.color }} />
                <span className="font-mono text-[11px] tracking-[.12em] text-muted uppercase">Confidence {s.confidence}/5</span>
              </span>
              <span className="font-display text-[34px] font-bold">{s.name}</span>
              <span className="mt-auto text-sm text-muted">
                {exam ? (
                  <>
                    Exam {fmtDate(exam.date, "EEE d MMM")} ·{" "}
                    <span style={days! <= 3 ? { color: "var(--bronze-hi)", fontWeight: 600 } : undefined}>
                      {days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`}
                    </span>
                  </>
                ) : (
                  "No exam scheduled"
                )}
              </span>
              <span className="subj">
                <span style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 10px", fontSize: 14 }}>
                  <span className="text-muted">Ready</span>
                  <b>{pct(ready)}</b>
                  <span className="bar">
                    <i style={{ width: pct(ready) }} />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
        <button
          id="add-subject"
          onClick={() => setEditing("new")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-2 text-muted transition-colors hover:border-bronze hover:text-ink"
          style={{ minHeight: 190 }}
        >
          <Plus size={16} /> Add a subject
        </button>
      </div>
      {editing && <SubjectModal p={p} subject={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function SubjectModal({ p, subject, onClose }: { p: Planner; subject: Subject | null; onClose: () => void }) {
  const exam = subject ? p.input.exams.find((e) => e.subjectId === subject.id) : undefined;
  const [name, setName] = useState(subject?.name ?? "");
  const [priority, setPriority] = useState<Level>(subject?.priority ?? 3);
  const [difficulty, setDifficulty] = useState<Level>(subject?.difficulty ?? 3);
  const [confidence, setConfidence] = useState<Level>(subject?.confidence ?? 3);
  const [examDate, setExamDate] = useState(exam?.date ?? "");
  const [topics, setTopics] = useState(subject?.topics.join(", ") ?? "");

  const save = () => {
    if (!name.trim()) return;
    p.setInput((prev) => {
      const id = subject?.id ?? `sub-${Math.random().toString(36).slice(2, 8)}`;
      const next: Subject = {
        id,
        name: name.trim(),
        color: subject?.color ?? SUBJECT_COLORS[prev.subjects.length % SUBJECT_COLORS.length],
        priority,
        difficulty,
        confidence,
        topics: topics.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
      };
      const subjects = subject ? prev.subjects.map((s) => (s.id === id ? next : s)) : [...prev.subjects, next];
      let exams = prev.exams.filter((e) => e.subjectId !== id);
      if (examDate) exams = [...exams, { id: exam?.id ?? `ex-${id}`, subjectId: id, date: examDate, title: exam?.title ?? `${next.name} exam` }];
      return { ...prev, subjects, exams };
    });
    onClose();
  };

  const remove = () => {
    if (!subject) return;
    p.setInput((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== subject.id),
      exams: prev.exams.filter((e) => e.subjectId !== subject.id),
      assignments: prev.assignments.filter((a) => a.subjectId !== subject.id),
    }));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={subject ? `Edit ${subject.name}` : "Add a subject"} subtitle="The plan updates as soon as you save.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label>
            <span className="mb-1 block text-sm text-ink-2">Subject name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operating Systems" autoFocus />
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-2">Exam date</span>
            <input type="date" className="field" value={examDate} min={p.today} onChange={(e) => setExamDate(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <LevelPicker label="Priority" value={priority} onChange={setPriority} />
          <LevelPicker label="Difficulty" value={difficulty} onChange={setDifficulty} />
          <LevelPicker label="Confidence" value={confidence} onChange={setConfidence} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-ink-2">Topics, weakest first</span>
          <textarea
            className="field min-h-20"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Normalization, Transactions, SQL joins"
          />
        </label>
        <div className="flex items-center justify-between pt-1">
          {subject ? (
            <button type="button" onClick={remove} className="btn text-[#e8a58c] hover:bg-rust/20">
              <Trash2 size={16} /> Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Save subject
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
