"use client";

import { useEffect, useRef } from "react";

/** The Aevia hero window: stars, a constellation, an orbiting moon, parallax hills and passing poles. Ported from the Aevia page. */
export function SkyScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0,
      H = 0;
    const C: Record<string, string> = {};
    let stars: { x: number; y: number; r: number; a: number; tw: number }[] = [];
    let cons: { x: number; y: number }[] = [];
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    ["--sky-top", "--sky-bot", "--sun", "--hill-far", "--hill-mid", "--hill-near", "--pole"].forEach((k) => (C[k] = css(k)));

    function size() {
      const r = cv!.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cv!.width = W * dpr;
      cv!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: 110 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.55,
        r: Math.random() * 1.1 + 0.3,
        a: Math.random() * 0.6 + 0.25,
        tw: Math.random() * 6,
      }));
      const cx = W * 0.2,
        cy = H * 0.12;
      cons = [
        [0, 0],
        [0.07, 0.06],
        [0.13, 0.03],
        [0.19, 0.1],
        [0.16, 0.19],
        [0.24, 0.16],
        [0.3, 0.08],
      ].map(([x, y]) => ({ x: cx + x * W, y: cy + y * H }));
    }
    const ridge = (x: number, seed: number, amp: number) =>
      Math.sin(x * 0.0021 + seed) * amp + Math.sin(x * 0.0053 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.013 + seed * 0.7) * amp * 0.14;
    const layers = [
      { c: "--hill-far", base: 0.58, amp: 0.07, speed: 0.05, seed: 1.2 },
      { c: "--hill-mid", base: 0.7, amp: 0.06, speed: 0.14, seed: 3.8 },
      { c: "--hill-near", base: 0.83, amp: 0.035, speed: 0.5, seed: 6.1 },
    ];
    let off = 0,
      last = performance.now(),
      t = 0,
      raf = 0;

    function draw() {
      const c = ctx!;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, C["--sky-top"]);
      g.addColorStop(1, C["--sky-bot"]);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#F3E2C4";
      stars.forEach((s) => {
        c.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(t * 0.002 + s.tw));
        c.beginPath();
        c.arc((s.x - off * 0.01 + W * 10) % W, s.y, s.r, 0, 7);
        c.fill();
      });
      // constellation
      c.globalAlpha = 0.45;
      c.strokeStyle = "#C9A176";
      c.lineWidth = 0.8;
      c.beginPath();
      cons.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = "#EDCFA3";
      cons.forEach((p) => {
        c.beginPath();
        c.arc(p.x, p.y, 1.8, 0, 7);
        c.fill();
      });
      // moon with orbits
      const sx = W * 0.72,
        sy = H * 0.32,
        sr = Math.max(26, H * 0.09);
      const glow = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4.5);
      glow.addColorStop(0, "rgba(234,211,172,.35)");
      glow.addColorStop(1, "rgba(234,211,172,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(201,161,118,.35)";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(sx, sy, sr * 2.3, sr * 0.9, -0.25, 0, 7);
      c.stroke();
      c.beginPath();
      c.ellipse(sx, sy, sr * 1.7, sr * 1.9, 0.6, 0, 7);
      c.stroke();
      const a = t * 0.0004;
      c.fillStyle = "#EDCFA3";
      c.beginPath();
      c.arc(
        sx + Math.cos(a) * sr * 2.3 * Math.cos(-0.25) - Math.sin(a) * sr * 0.9 * Math.sin(-0.25),
        sy + Math.cos(a) * sr * 2.3 * Math.sin(-0.25) + Math.sin(a) * sr * 0.9 * Math.cos(-0.25),
        3,
        0,
        7,
      );
      c.fill();
      const mg = c.createRadialGradient(sx - sr * 0.35, sy - sr * 0.35, sr * 0.1, sx, sy, sr);
      mg.addColorStop(0, "#F6E3C2");
      mg.addColorStop(0.7, C["--sun"]);
      mg.addColorStop(1, "#A9855E");
      c.fillStyle = mg;
      c.beginPath();
      c.arc(sx, sy, sr, 0, 7);
      c.fill();
      layers.forEach((L) => {
        c.fillStyle = C[L.c];
        c.beginPath();
        c.moveTo(0, H);
        for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, H * L.base + ridge(x + off * L.speed, L.seed, H * L.amp));
        c.lineTo(W, H);
        c.closePath();
        c.fill();
      });
      const gap = Math.max(260, W * 0.32),
        p = (off * 1.4) % gap;
      c.strokeStyle = C["--pole"];
      c.fillStyle = C["--pole"];
      c.lineWidth = 1.2;
      const tops: number[] = [];
      for (let x = -p; x < W + gap; x += gap) {
        const top = H * 0.2;
        tops.push(x);
        c.fillRect(x - 3, top, 6, H - top);
        c.fillRect(x - 22, top + 10, 44, 4);
      }
      for (let i = 0; i < tops.length - 1; i++) {
        [H * 0.2 + 12, H * 0.2 + 30].forEach((y, j) => {
          c.beginPath();
          c.moveTo(tops[i] + (j ? 12 : -18), y);
          c.quadraticCurveTo((tops[i] + tops[i + 1]) / 2, y + H * 0.05, tops[i + 1] + (j ? 12 : -18), y);
          c.stroke();
        });
      }
    }
    function frame(now: number) {
      const dt = Math.min(now - last, 50);
      last = now;
      off += dt * 0.9;
      t += dt;
      draw();
      raf = requestAnimationFrame(frame);
    }
    size();
    const onResize = () => {
      size();
      draw();
    };
    addEventListener("resize", onResize);
    if (reduce) {
      off = 400;
      draw();
    } else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
