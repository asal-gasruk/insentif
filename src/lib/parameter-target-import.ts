import parameterTargetsExcel from "@/data/parameter-targets-excel.json";
import type { ParameterTarget, Team } from "@/types";

export type ParameterTargetsDump = typeof parameterTargetsExcel;

function slugTeamCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Resolve Excel team code → seed team id `sfa-team-{code}` */
export function teamIdFromCode(code: string): string {
  return `sfa-team-${slugTeamCode(code)}`;
}

export function buildParameterTargets(teams: Team[]): ParameterTarget[] {
  const teamIds = new Set(teams.map((t) => t.id));
  const out: ParameterTarget[] = [];
  let skipped = 0;

  for (const row of parameterTargetsExcel.targets) {
    const teamId = teamIdFromCode(row.teamCode);
    if (!teamIds.has(teamId)) {
      skipped += 1;
      continue;
    }
    out.push({
      id: `pt-${row.period}-${slugTeamCode(row.teamCode)}-${row.paramId}`,
      teamId,
      paramId: row.paramId,
      period: row.period,
      target: row.target,
      notes: row.salesman
        ? `Import Excel · ${row.salesman} · ${row.sheet}`
        : `Import Excel · ${row.sheet}`,
    });
  }

  if (typeof console !== "undefined" && skipped > 0) {
    // Build-time / SSR silent; useful when debugging in Node verify scripts
  }

  return out;
}

export function getParameterTargetsDumpStats() {
  return {
    period: parameterTargetsExcel.period,
    totalRows: parameterTargetsExcel.targets.length,
  };
}
