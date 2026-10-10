import { IDEATION_API_CATALOG, recommendApisFromText } from "@/data/ideation-api-catalog";
import type { IdeationCodeBundle } from "@/types/ideation";

const TAILWIND_CDN = `<script src="https://cdn.tailwindcss.com"></script>`;

export function normalizeHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return trimmed;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${TAILWIND_CDN}
  <title>Prototype</title>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100">
${trimmed}
</body>
</html>`;
}

export function isValidRunnableHtml(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length < 80) return false;
  if (!/<(?:html|body|div|section|main|header)/i.test(trimmed)) return false;
  return true;
}

export function injectEnvScript(html: string, envVars: Record<string, string>): string {
  const active = Object.fromEntries(
    Object.entries(envVars).filter(([, value]) => value.trim()),
  );

  if (Object.keys(active).length === 0) return html;

  const script = `<script>window.__PIVOTON_ENV__=${JSON.stringify(active)};</script>`;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }

  return `${script}${html}`;
}

export function detectBundleFormat(html: string): IdeationCodeBundle["format"] {
  const trimmed = html.trim();
  // Full HTML documents always run in the HTML sandbox — never misroute to React runner.
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return "html";
  }
  if (/<script[^>]*type=["']text\/babel["']/i.test(html)) {
    return "react";
  }
  return "html";
}

export function buildCodeBundleFromHtml(html: string): IdeationCodeBundle {
  const normalized = normalizeHtml(html);
  if (!normalized) {
    return { format: "html", entry: "index.html", files: {} };
  }

  const format = detectBundleFormat(normalized);

  if (format === "react") {
    const appSource = extractInlineScript(normalized);
    if (!appSource) {
      return { format: "html", entry: "index.html", files: { "index.html": normalized } };
    }
    return {
      format: "react",
      entry: "App.jsx",
      files: {
        "App.jsx": appSource,
        "styles.css": extractInlineStyles(normalized),
        "index.html": normalized,
      },
    };
  }

  return {
    format: "html",
    entry: "index.html",
    files: { "index.html": normalized },
  };
}

function extractInlineScript(html: string): string {
  const match = html.match(/<script[^>]*type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
  return match?.[1]?.trim() ?? "";
}

function extractInlineStyles(html: string): string {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match?.[1]?.trim() ?? "";
}

export function reactBundleToHtml(bundle: IdeationCodeBundle): string {
  const appSource = bundle.files["App.jsx"] ?? bundle.files["App.js"] ?? "";
  const styles = bundle.files["styles.css"] ?? "";

  if (!appSource.trim()) {
    return bundle.files["index.html"] ?? "";
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${TAILWIND_CDN}
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${styles}</style>
  <title>Prototype</title>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100">
  <div id="root"></div>
  <script type="text/babel">
${appSource}
const root = ReactDOM.createRoot(document.getElementById("root"));
const AppComponent = typeof App !== "undefined" ? App : (() => <div class="p-6">App component missing</div>);
root.render(<AppComponent />);
  </script>
</body>
</html>`;
}

export function codeBundleToRunnableHtml(bundle: IdeationCodeBundle): string {
  const indexHtml = bundle.files["index.html"]?.trim();
  if (indexHtml && (indexHtml.startsWith("<!DOCTYPE") || indexHtml.startsWith("<html"))) {
    return indexHtml;
  }
  if (bundle.format === "react") {
    return reactBundleToHtml(bundle);
  }
  return bundle.files[bundle.entry] ?? indexHtml ?? "";
}

export function resolveRunnableHtml(
  html: string,
  codeBundle?: IdeationCodeBundle | null,
): string {
  if (codeBundle && !isCodeBundleEmpty(codeBundle)) {
    const fromBundle = codeBundleToRunnableHtml(codeBundle);
    if (isValidRunnableHtml(fromBundle)) return fromBundle;
  }
  const normalized = normalizeHtml(html);
  if (isValidRunnableHtml(normalized)) return normalized;
  return "";
}

export function buildRunnableSrcDoc(
  html: string,
  envVars: Record<string, string> = {},
  codeBundle?: IdeationCodeBundle | null,
): string {
  const baseHtml = resolveRunnableHtml(html, codeBundle);
  if (!baseHtml) return "";
  return injectEnvScript(baseHtml, envVars);
}

type AppArchetype = "taxi" | "delivery" | "proptech" | "saas" | "generic";

function inferAppArchetype(prompt: string): AppArchetype {
  const lower = prompt.toLowerCase();
  if (/taxi|ride.?share|book.*(car|ride|cab)|uber|lyft/.test(lower)) return "taxi";
  if (/delivery|food|restaurant|order.*online|meal/.test(lower)) return "delivery";
  if (/real estate|proptech|property|listing|for sale/.test(lower)) return "proptech";
  if (/saas|landing|subscription|checkout/.test(lower)) return "saas";
  return "generic";
}

function supabaseBootScript(): string {
  return `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
(function () {
  var env = window.__PIVOTON_ENV__ || {};
  var statusEl = document.getElementById("db-status");
  if (!statusEl) return;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    statusEl.textContent = "Add Supabase keys in Ideation to enable live data.";
    return;
  }
  try {
    window.__supabase = supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    statusEl.textContent = "Supabase connected · " + env.SUPABASE_URL.replace(/^https?:\\/\\//, "");
  } catch (e) {
    statusEl.textContent = "Supabase client error — check your project URL and anon key.";
  }
})();
</script>`;
}

function buildArchetypeBody(archetype: AppArchetype, prompt: string): string {
  const escaped = prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  switch (archetype) {
    case "taxi":
      return `
    <div class="max-w-md mx-auto space-y-4">
      <header class="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p class="text-xs uppercase tracking-wider text-cyan-400">RideNow MVP</p>
        <h1 class="mt-1 text-xl font-semibold">Book your ride</h1>
        <p class="mt-2 text-xs text-slate-500">${escaped}</p>
      </header>
      <section class="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
        <label class="block text-xs text-slate-400">Pickup location</label>
        <input id="pickup" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm" placeholder="Enter pickup address" />
        <label class="block text-xs text-slate-400">Drop-off location</label>
        <input id="dropoff" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm" placeholder="Enter destination" />
        <button id="book-btn" class="w-full rounded-lg bg-cyan-500 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Request ride</button>
        <p id="ride-status" class="text-xs text-slate-500">Ready to match you with a driver.</p>
      </section>
      <p id="db-status" class="text-center text-[10px] text-slate-600">Checking database…</p>
    </div>
    <script>
      document.getElementById("book-btn").onclick = function () {
        var pickup = document.getElementById("pickup").value.trim();
        var dropoff = document.getElementById("dropoff").value.trim();
        var el = document.getElementById("ride-status");
        if (!pickup || !dropoff) { el.textContent = "Enter pickup and drop-off to continue."; return; }
        el.textContent = "Searching drivers near " + pickup + "…";
        setTimeout(function () { el.textContent = "Driver assigned! ETA 4 min · Trip to " + dropoff; }, 1200);
      };
    </script>`;
    case "delivery":
      return `
    <div class="max-w-2xl mx-auto space-y-4">
      <header class="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p class="text-xs uppercase tracking-wider text-cyan-400">FoodHub MVP</p>
        <h1 class="mt-1 text-xl font-semibold">Order from local stores</h1>
        <p class="mt-2 text-xs text-slate-500">${escaped}</p>
      </header>
      <div class="grid gap-3 sm:grid-cols-2">
        <article class="rounded-xl border border-slate-700 bg-slate-900 p-4"><h2 class="font-medium">Green Bowl Co.</h2><p class="text-xs text-slate-500 mt-1">Salads · 20–30 min</p><button class="mt-3 w-full rounded-lg bg-cyan-500 py-2 text-xs font-semibold text-slate-950">View menu</button></article>
        <article class="rounded-xl border border-slate-700 bg-slate-900 p-4"><h2 class="font-medium">Night Slice</h2><p class="text-xs text-slate-500 mt-1">Pizza · 25–35 min</p><button class="mt-3 w-full rounded-lg bg-cyan-500 py-2 text-xs font-semibold text-slate-950">View menu</button></article>
      </div>
      <p id="db-status" class="text-center text-[10px] text-slate-600">Checking database…</p>
    </div>`;
    case "proptech":
      return `
    <div class="max-w-2xl mx-auto space-y-4">
      <header class="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p class="text-xs uppercase tracking-wider text-cyan-400">PropList MVP</p>
        <h1 class="mt-1 text-xl font-semibold">Properties for sale by owner</h1>
        <p class="mt-2 text-xs text-slate-500">${escaped}</p>
      </header>
      <div class="grid gap-3 sm:grid-cols-2">
        <article class="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"><div class="h-28 bg-slate-800"></div><div class="p-4"><p class="text-sm font-medium">2BR Condo · Downtown</p><p class="text-cyan-400 text-sm mt-1">$425,000</p></div></article>
        <article class="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"><div class="h-28 bg-slate-800"></div><div class="p-4"><p class="text-sm font-medium">3BR Home · Suburbs</p><p class="text-cyan-400 text-sm mt-1">$689,000</p></div></article>
      </div>
      <button class="w-full rounded-lg border border-slate-600 py-2.5 text-sm hover:bg-slate-800">List your property</button>
      <p id="db-status" class="text-center text-[10px] text-slate-600">Checking database…</p>
    </div>`;
    default:
      return `
    <div class="max-w-lg mx-auto space-y-4">
      <header class="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p class="text-xs uppercase tracking-wider text-cyan-400">Pivoton MVP</p>
        <h1 class="mt-1 text-xl font-semibold">Your product preview</h1>
        <p class="mt-2 text-sm text-slate-400">${escaped}</p>
      </header>
      <section class="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <button class="w-full rounded-lg bg-cyan-500 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Get started</button>
      </section>
      <p id="db-status" class="text-center text-[10px] text-slate-600">Checking database…</p>
    </div>`;
  }
}

export function buildPromptScaffoldHtml(
  prompt: string,
  apiIds: string[],
  envVars: Record<string, string>,
  wired: boolean,
): string {
  const archetype = inferAppArchetype(prompt);
  const hasSupabase = apiIds.includes("supabase");
  const showSupabase = hasSupabase && wired && envVars.SUPABASE_URL?.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${TAILWIND_CDN}
  ${showSupabase ? '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>' : ""}
  <title>Prototype Preview</title>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
  ${buildArchetypeBody(archetype, prompt)}
  ${showSupabase ? supabaseBootScript() : ""}
</body>
</html>`;
}

export function buildWiredFallbackHtml(
  prompt: string,
  apiIds: string[],
  envVars: Record<string, string>,
): string {
  return buildPromptScaffoldHtml(prompt, apiIds, envVars, true);
}

export function buildFallbackHtml(prompt: string, apiIds: string[]): string {
  return buildPromptScaffoldHtml(prompt, apiIds, {}, false);
}

export function ensurePrototypeHtml(
  html: string,
  options: {
    fallbackPrompt: string;
    envVars?: Record<string, string>;
    wired?: boolean;
  },
): string {
  const trimmed = html.trim();
  if (trimmed && isValidRunnableHtml(trimmed)) {
    return normalizeHtml(trimmed);
  }

  const apiIds = recommendApisFromText(options.fallbackPrompt);
  return buildPromptScaffoldHtml(
    options.fallbackPrompt,
    apiIds,
    options.envVars ?? {},
    Boolean(options.wired && options.envVars && Object.keys(options.envVars).length > 0),
  );
}

/** Public-safe env vars for feed embeds (anon keys OK; strip server secrets). */
export function filterPublicEnvVars(envVars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(envVars).filter(([key]) => {
      if (/SECRET|PASSWORD|PRIVATE/i.test(key)) return false;
      if (/STRIPE_SECRET|SK_TEST|SK_LIVE/i.test(key)) return false;
      if (/^GEMINI_|^VITE_GEMINI_/i.test(key)) return false;
      return true;
    }),
  );
}

export function isCodeBundleEmpty(bundle: IdeationCodeBundle | null | undefined): boolean {
  if (!bundle) return true;
  return Object.keys(bundle.files).length === 0;
}
