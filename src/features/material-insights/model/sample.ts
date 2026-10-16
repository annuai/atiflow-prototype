import type { MaterialRequest } from './types';

/** Example materials for the sample data (the names of the sample workflows in Master Data). */
const CATALOG = [
  { code: 'DCP-1001', name: 'Drive Chain Pin 8mm', qty: 20, approval: true },
  { code: 'DCP-1002', name: 'Drive Chain Plate 12mm', qty: 10, approval: false },
  { code: 'DCP-1003', name: 'Chain Sprocket 24T', qty: 5, approval: true },
  { code: 'DCP-1004', name: 'DC Power Cable 2m', qty: 15, approval: false },
  { code: 'DCP-1005', name: 'Bearing Housing 40mm', qty: 8, approval: true },
  { code: 'DCP-1006', name: 'Fastener Kit M6', qty: 40, approval: false },
];
const STATIONS = ['STA-116', 'STA-117', 'STA-107', 'STA-105', 'STA-110', 'STA-113'];

/** A small seeded generator, so the sample data is the same every time the same period is asked for. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/**
 * EXAMPLE material requests for [from, to) so the views can be reviewed before there is real data: 6 am to 10 pm, a few requests an hour with a lunch dip, most delivered, a few
 * cancelled / rejected / failed, and (when `now` is inside the period) a handful still open. NOT real: the views label it "Sample data".
 */
export function sampleRequests(from: Date, to: Date, fleets: string[], now = Date.now()): MaterialRequest[] {
  const out: MaterialRequest[] = [];
  const fleet = fleets.length ? fleets : ['Line Side Fleet'];
  const day0 = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime();
  let n = 0;
  for (let d = day0; d < end; d += 86_400_000) {
    const r = rng(Math.floor(d / 86_400_000));
    for (let h = 6; h < 22; h++) {
      const rate = h >= 12 && h < 13 ? 1 : h < 8 || h >= 20 ? 2 : 4;
      for (let i = 0; i < rate; i++) {
        const m = CATALOG[Math.floor(r() * CATALOG.length)];
        const created = d + h * 3_600_000 + Math.floor(r() * 3_600_000);
        if (created > now) continue;
        const qty = Math.max(1, Math.round(m.qty * (0.5 + r())));
        const approvalMs = m.approval ? (2 + r() * 8) * 60_000 : 0,
          waitMs = (1 + r() * 5) * 60_000,
          carryMs = (3 + r() * 6) * 60_000;
        const approved = created + approvalMs,
          ongoing = approved + waitMs,
          completed = ongoing + carryMs;
        const roll = r();
        const base: MaterialRequest = {
          id: `S-${++n}`,
          fleet: fleet[Math.floor(r() * fleet.length)],
          code: m.code,
          name: m.name,
          qty,
          status: 'completed',
          needsApproval: m.approval,
          createdAt: created,
          legs: [STATIONS[Math.floor(r() * 3)], STATIONS[3 + Math.floor(r() * 3)]],
          at: {},
        };
        const open = completed > now;
        if (roll < 0.04)
          out.push({ ...base, status: 'cancelled', at: { cancelled: Math.min(created + 4 * 60_000, now) } });
        else if (roll < 0.06 && m.approval)
          out.push({ ...base, status: 'rejected', at: { rejected: Math.min(approved, now) } });
        else if (roll < 0.075 && !open)
          out.push({ ...base, status: 'failed', at: { approved, ongoing, failed: completed } });
        else if (!open) out.push({ ...base, at: { approved, ongoing, completed } });
        else if (now < approved) out.push({ ...base, status: 'pending', at: {} });
        else if (now < ongoing) out.push({ ...base, status: 'approved', at: { approved }, robotId: undefined });
        else
          out.push({
            ...base,
            status: 'ongoing',
            at: { approved, ongoing },
            robotId: `AMR-0${String(1 + Math.floor(r() * 9)).padStart(2, '0')}`,
          });
      }
    }
  }
  return out;
}
