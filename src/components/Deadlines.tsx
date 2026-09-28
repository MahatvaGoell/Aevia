"use client";

import { GraduationCap, Plus, X } from "lucide-react";
import { useState } from "react";
import { daysBetween } from "@/lib/scheduler";
import type { Planner } from "@/lib/usePlanner";
import { fmtDate, Modal, priorityChip } from "./ui";

type Row = {
  key: string;
  task: string;
  subjectId: string;
  date: string;
  isExam: boolean;
  status: { label: string; className: string };
  onDelete?: () => void;
};

export function Deadlines({ p }: { p: Planner }) {
  const [adding, setAdding] = useState(false);
  const subjectOf = (id: string) => p.input.subjects.find((s) => s.id === id);

  const rows: Row[] = [
    ...p.input.assignments.map((a) => {
      const done = p.completed.filter((c) => c.assignmentId === a.id).reduce((m, c) => m + c.minutes, 0);
      const overdue = daysBetween(p.today, a.dueDate) < 0;
      const status =
        done >= a.estimatedHours * 60 * 0.95
          ? { label: "Done", className: "bg-olive/45 text-[#c3d0a2]" }
          : overdue
            ? { label: "Overdue", className: "bg-rust/45 text-[#f0b8a4]" }
            : done > 0
              ? { label: "In progress", className: "bg-ochre/40 text-[#e6c07e]" }
              : { label: "To do", className: "bg-copper/45 text-[#e9c4a4]" };
      return {
        key: a.id,
        task: a.title,
        subjectId: a.subjectId,
        date: a.dueDate,
        isExam: false,
        status,
        onDelete: () => p.setInput((prev) => ({ ...prev, assignments: prev.assignments.filter((x) => x.id !== a.id) })),
      };
    }),
    ...p.input.exams.map((e) => {
      const d = daysBetween(p.today, e.date);
      return {
        key: e.id,
        task: e.title,
        subjectId: e.subjectId,
        date: e.date,
        isExam: true,
        status:
          d < 0
            ? { label: "Finished", className: "bg-panel-3 text-muted" }
            : { label: d === 0 ? "Exam today" : `Exam in ${d}d`, className: d <= 3 ? "bg-rust/45 text-[#f0b8a4]" : "bg-slate-600/30 text-[#b9c6cc]" },
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section id="deadlines" className="scroll-mt-6">
      <h2 className="section-title mb-2">Assignments & deadlines</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[0.95rem]">
          <thead>
            <tr className="text-left text-sm text-ink-2">
              <th className="py-1.5 pr-3 font-normal">Task</th>
              <th className="py-1.5 pr-3 font-normal">Priority</th>
              <th className="py-1.5 pr-3 font-normal">Subject</th>
              <th className="py-1.5 pr-3 font-normal">Due</th>
              <th className="py-1.5 font-normal">Status</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = subjectOf(r.subjectId);
              const chip = priorityChip(s?.priority ?? 3);
              return (
                <tr key={r.key} className="group border-t border-line/80">
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2">
                      {r.isExam && <GraduationCap size={15} className="shrink-0 text-gold" />}
                      {r.task}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={`chip ${chip.className}`}>{chip.label}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-ink-2">{s?.name}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-2">{fmtDate(r.date, "d MMM")}</td>
                  <td className="py-1.5">
                    <span className={`chip ${r.status.className}`}>{r.status.label}</span>
                  </td>
                  <td className="py-1.5 text-right">
                    {r.onDelete && (
                      <button
                        onClick={r.onDelete}
                        aria-label={`Delete ${r.task}`}
                        className="text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="border-t border-line py-4 text-center text-muted">
                  No deadlines yet. Add an exam date to a subject, or add an assignment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button onClick={() => setAdding(true)} disabled={!p.input.subjects.length} className="mt-2 flex items-center gap-1.5 text-sm text-muted hover:text-ink disabled:opacity-40">
        <Plus size={15} /> Add an assignment
      </button>
      {adding && <AssignmentModal p={p} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AssignmentModal({ p, onClose }: { p: Planner; onClose: () => void }) {
  const [subjectId, setSubjectId] = useState(p.input.subjects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [hours, setHours] = useState(2);
  const valid = subjectId && title.trim() && due;
  return (
    <Modal open onClose={onClose} title="Add an assignment" width="max-w-lg">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          p.setInput((prev) => ({
            ...prev,
            assignments: [
              ...prev.assignments,
              { id: `as-${Math.random().toString(36).slice(2, 8)}`, subjectId, title: title.trim(), dueDate: due, estimatedHours: Math.max(0.5, hours) },
            ],
          }));
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-ink-2">Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lab report 3" autoFocus />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-3 sm:col-span-1">
            <span className="mb-1 block text-sm text-ink-2">Subject</span>
            <select className="field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {p.input.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-2">Due</span>
            <input type="date" className="field" min={p.today} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-2">Hours needed</span>
            <input type="number" min={0.5} step={0.5} className="field" value={hours} onChange={(e) => setHours(+e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Add assignment
          </button>
        </div>
      </form>
    </Modal>
  );
}
