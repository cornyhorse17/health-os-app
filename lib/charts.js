import uPlot from '../vendor/uplot.js';
import { parseYmd, shortDate } from './dates.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4'];

// series: [{label, values:[number|null], color:'--c1', scale?:'y'|'y2'}]; dates: ['YYYY-MM-DD']
// markers: [{date, label}] drawn as vertical dashed lines
export function lineChart(el, { dates, series, markers = [], height = 180, yRange }) {
  const xs = dates.map((d) => parseYmd(d).getTime() / 1000);
  const grid = css('--grid'); const axis = css('--text-2');
  const opts = {
    width: el.clientWidth || 320, height,
    padding: [8, 8, 0, 0],
    legend: { show: false },
    cursor: { drag: { x: false, y: false }, points: { size: 6 } },
    scales: { x: { time: true }, y: yRange ? { range: yRange } : { auto: true }, y2: { auto: true } },
    axes: [
      { stroke: axis, grid: { stroke: grid, width: 1 }, ticks: { show: false }, font: '11px -apple-system, system-ui', values: (u, vals) => vals.map((v) => shortDate(new Date(v * 1000).toISOString().slice(0, 10))), space: 60 },
      { stroke: axis, grid: { stroke: grid, width: 1 }, ticks: { show: false }, font: '11px -apple-system, system-ui', size: 34 },
      ...(series.some((s) => s.scale === 'y2') ? [{ scale: 'y2', side: 1, stroke: axis, grid: { show: false }, ticks: { show: false }, font: '11px -apple-system, system-ui', size: 34 }] : []),
    ],
    series: [{}, ...series.map((s) => ({ label: s.label, stroke: css(s.color), width: 2, scale: s.scale || 'y', spanGaps: true, points: { show: s.values.filter((v) => v != null).length < 20, size: 5, fill: css(s.color) } }))],
    hooks: {
      draw: [(u) => {
        const ctx = u.ctx; ctx.save(); ctx.strokeStyle = css('--text-3'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        for (const m of markers) {
          const x = u.valToPos(parseYmd(m.date).getTime() / 1000, 'x', true);
          if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) continue;
          ctx.beginPath(); ctx.moveTo(x, u.bbox.top); ctx.lineTo(x, u.bbox.top + u.bbox.height); ctx.stroke();
        }
        ctx.restore();
      }],
    },
  };
  const u = new uPlot(opts, [xs, ...series.map((s) => s.values)], el);
  const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height }));
  ro.observe(el);
  return () => { ro.disconnect(); u.destroy(); };
}
