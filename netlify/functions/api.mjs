import { getStore } from "@netlify/blobs";

const KEY = "lexextract-state";
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function checkAuth(req) {
  const expected = process.env.TEAM_PASSCODE;
  if (!expected) return "TEAM_PASSCODE is not set on the site — add it in Netlify environment variables.";
  const given = req.headers.get("x-team-pass") || "";
  if (given !== expected) return "unauthorised";
  return null;
}

async function readState(store) {
  const raw = await store.get(KEY, { type: "json" });
  if (!raw) return { version: 0, state: null };
  return raw;
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  // passcode check endpoint — no auth required, returns whether the given pass is right
  if (action === "login") {
    const { pass } = await req.json().catch(() => ({}));
    const expected = process.env.TEAM_PASSCODE;
    if (!expected) return json({ ok: false, error: "TEAM_PASSCODE is not set on this site." }, 500);
    return json({ ok: pass === expected });
  }

  const authErr = checkAuth(req);
  if (authErr) return json({ error: authErr }, authErr === "unauthorised" ? 401 : 500);

  const store = getStore({ name: "lexextract", consistency: "strong" });

  try {
    if (action === "state" && req.method === "GET") {
      const cur = await readState(store);
      return json(cur);
    }

    if (action === "state" && req.method === "POST") {
      const { version, state, who } = await req.json();
      const cur = await readState(store);
      if (cur.state && Number(version) !== Number(cur.version)) {
        return json({ conflict: true, version: cur.version, state: cur.state }, 409);
      }
      const next = { version: (cur.version || 0) + 1, state, savedBy: who || "", savedAt: new Date().toISOString() };
      await store.setJSON(KEY, next);
      return json({ version: next.version, savedAt: next.savedAt, savedBy: next.savedBy });
    }

    // field-level lead update: applied server-side so concurrent AEs never clobber each other
    if (action === "lead" && req.method === "POST") {
      const { leadId, fields, note, who } = await req.json();
      const cur = await readState(store);
      if (!cur.state) return json({ error: "No data saved yet." }, 400);
      const lead = (cur.state.leads || []).find((l) => l.id === leadId);
      if (!lead) return json({ error: "Lead not found — reload the page." }, 404);
      const changed = [];
      Object.entries(fields || {}).forEach(([k, v]) => {
        if (lead[k] !== v) { changed.push(k); lead[k] = v; }
      });
      lead.notes = lead.notes || [];
      if (note) lead.notes.push({ d: new Date().toISOString().slice(0, 10), t: `${note}${who ? ` — ${who}` : ""}` });
      if (changed.length) {
        lead.lastEditBy = who || "";
        lead.lastEditAt = new Date().toISOString().slice(0, 16).replace("T", " ");
        cur.state.log = cur.state.log || [];
        cur.state.log.unshift({ d: lead.lastEditAt, m: `${who || "someone"} updated ${lead.leadId}: ${changed.join(", ")}` });
        cur.state.log = cur.state.log.slice(0, 500);
      }
      const next = { version: (cur.version || 0) + 1, state: cur.state, savedBy: who || "", savedAt: new Date().toISOString() };
      await store.setJSON(KEY, next);
      return json({ version: next.version, lead });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }
};

export const config = { path: "/api/*" };

