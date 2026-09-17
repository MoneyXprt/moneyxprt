/** Renders the fixed, flow-level Audit position independently from local question progress. */
export function AuditSectionProgress({ name, index }: { name: string; index: number }) {
  return <p className="text-xs font-semibold text-emerald-700">{name} · Section {index} of 6</p>;
}
