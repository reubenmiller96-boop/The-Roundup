export function normalizeFirm(name) {
  return String(name || "").toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(llp|llc|ltd|limited|plc|lp|the|uk|solicitors|solicitor|law firm|lawyers|legal)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function cleanAEs(values) {
  const owners = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : [values]) {
    for (const owner of String(value || "").split(/[\/,&+]| and /i).map(name => name.trim())) {
      if (!owner || /^(n\/?a|na|n|a|unassigned|none|tbc|-{1,3}|\?+)$/i.test(owner)) continue;
      const key = owner.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        owners.push(owner);
      }
    }
  }
  return owners;
}

export function matchingFirms(firms, name) {
  const normalized = normalizeFirm(name);
  if (!normalized) return [];
  return firms.filter(firm => normalizeFirm(firm.canonical) === normalized ||
    (firm.aliases || []).some(alias => normalizeFirm(alias) === normalized));
}

export function reconcileLeadAssignments(state) {
  const firms = state.firms || [];
  const report = { linked: 0, assigned: 0, statusFixed: 0, changed: false };
  for (const lead of state.leads || []) {
    const hasOwners = (lead.owners || []).some(owner => String(owner || "").trim());
    if (hasOwners && lead.ownership === "Available to Claim" && !lead.claimedBy) {
      lead.ownership = "Assigned";
      report.statusFixed++;
    }
    let firm = lead.firmId ? firms.find(candidate => candidate.id === lead.firmId) : null;
    if (!firm) {
      const matches = matchingFirms(firms, lead.firmDisplay);
      if (matches.length !== 1) continue;
      firm = matches[0];
    }
    if (lead.firmId !== firm.id) {
      lead.firmId = firm.id;
      report.linked++;
    }
    const owners = cleanAEs(firm.aes || []);
    if (!owners.length || /^chambers$/i.test(firm.type || "") ||
      (!firm.type && /chambers/i.test(firm.canonical || ""))) continue;
    if (hasOwners || lead.claimedBy || lead.assignmentSource === "manual" ||
      (lead.ownership && !["Available to Claim", "Assigned"].includes(lead.ownership))) continue;
    lead.owners = [...owners];
    lead.ownership = "Assigned";
    lead.assignmentSource = "firm";
    report.assigned++;
  }
  report.changed = report.linked > 0 || report.assigned > 0 || report.statusFixed > 0;
  return report;
}
