const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;
const GITHUB_TOKEN = process.env.GITHUB_ACTIONS_TOKEN;

const PREP_COMMIT_SHA = '731e4ad50e34e6587258a6a67ceeb895e10b5366';

const REPOS = [
  { name: 'Obsidian', repo: 'itenium-be/Bootcamp-AI-Obsidian', color: '#8b5cf6', logo: 'logos/Team-Obsidian.png', frontendPort: 5180 },
  { name: 'RoyalPurple', repo: 'itenium-be/Bootcamp-AI-RoyalPurple', color: '#7851a9', logo: 'logos/Team-RoyalPurple.png', frontendPort: 5181 },
  { name: 'Teal', repo: 'itenium-be/Bootcamp-AI-Teal', color: '#008080', logo: 'logos/Team-Teal.png', frontendPort: 5182 },
  { name: 'Emerald', repo: 'itenium-be/Bootcamp-AI-Emerald', color: '#50c878', logo: 'logos/Team-Emerald.png', frontendPort: 5183 },
  { name: 'Crimson', repo: 'itenium-be/Bootcamp-AI-Crimson', color: '#dc143c', logo: 'logos/Team-Crimson.png', frontendPort: 5184 },
  { name: 'MidnightBlue', repo: 'itenium-be/Bootcamp-AI-MidnightBlue', color: '#6366f1', logo: 'logos/Team-MidnightBlue.png', frontendPort: 5185 },
];


import JSZip from 'jszip';

// Cache configuration
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
let cachedData: { teams: any[]; tokenUsage: any[] } | null = null;
let cacheTimestamp = 0;

const TEAM_MEMBERS: Record<string, string[]> = {
  'Obsidian': ['Willem Meylemans', 'Igor Romy', 'Timo Versonnen', 'Onur Bugdayci', 'Jochem Van Hespen'],
  'RoyalPurple': ['Bo Rosseel', 'Joris Wijnant', 'Thomas De Brauwer', 'Michael Dumortier', 'Tim Ranson', 'Tom Marroyen'],
  'Teal': ['Steven Robijns', 'Pierre Bossé', 'Nina Van Hoof', 'Bert Maes', 'Tyara Schetgens'],
  'Emerald': ['Jelle Muijzelaar', 'Bert Vervaele', 'Yannick Manfroy', 'Bernard Giorgino', 'Remco Verbruggen', 'Gert Claeskens'],
  'Crimson': ['Heleen de Meue', 'Jonathan Rasquin', 'David Sverdlov', 'Jelle Maes', 'Bram De Plekker'],
  'MidnightBlue': ['Alexander Ryckeboer', 'Nicolas Legrand', "Joachim D'hondt", 'Jos Van Loock', 'Tom Mennes'],
};

function getTeamForPerson(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [team, members] of Object.entries(TEAM_MEMBERS)) {
    if (members.some(m => m.toLowerCase() === lower)) return team;
  }
  return null;
}

// Metrics history storage (10-min snapshots, max 144 = 24h)
interface MetricsSnapshot {
  timestamp: number;
  teams: {
    name: string;
    testsPassing: number;
    totalCommits: number;
    linesAdded: number;
    mergedPRs: number;
    tokensBurned: number;
  }[];
}

const METRICS_HISTORY_FILE = import.meta.dir + '/metrics-history.json';
const TEAM_NAMES_FILE = import.meta.dir + '/team-names.json';
const DATA_CACHE_FILE = import.meta.dir + '/data-cache.json';

let teamNamesMapping: Record<string, string> = {};

async function loadTeamNames() {
  try {
    const file = Bun.file(TEAM_NAMES_FILE);
    if (file.size > 0) {
      teamNamesMapping = JSON.parse(await file.text());
      console.log('Loaded team names mapping from disk');
    }
  } catch {
    console.log('No team-names.json found, starting with empty mapping');
  }
}

await loadTeamNames();

async function loadMetricsHistory(): Promise<MetricsSnapshot[]> {
  try {
    const file = Bun.file(METRICS_HISTORY_FILE);
    if (file.size > 0) {
      const data = JSON.parse(await file.text());
      console.log(`Loaded ${data.length} metrics history snapshots from disk`);
      return data;
    }
  } catch {
    // File doesn't exist yet or is invalid — start fresh
  }
  return [];
}

async function saveMetricsHistory() {
  try {
    await Bun.write(METRICS_HISTORY_FILE, JSON.stringify(metricsHistory));
  } catch (e) {
    console.error('Failed to save metrics history:', e);
  }
}

let metricsHistory: MetricsSnapshot[] = [];

async function loadDataCache(): Promise<{ teams: any[]; tokenUsage: any[] } | null> {
  try {
    const file = Bun.file(DATA_CACHE_FILE);
    if (file.size > 0) {
      const data = JSON.parse(await file.text());
      console.log('Loaded data cache from disk');
      return data;
    }
  } catch {
    // File doesn't exist yet or is invalid
  }
  return null;
}

async function saveDataCache(data: { teams: any[]; tokenUsage: any[] }) {
  try {
    await Bun.write(DATA_CACHE_FILE, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data cache:', e);
  }
}

// Load persisted history and data cache on startup
(async () => {
  metricsHistory = await loadMetricsHistory();
  const saved = await loadDataCache();
  if (saved) {
    cachedData = saved;
    // Don't set cacheTimestamp so first request triggers a fresh fetch
  }
})();

async function recordMetricsHistory() {
  if (!cachedData || cachedData.teams.length === 0) return;

  // Aggregate token usage per team
  const tokensByTeam: Record<string, number> = {};
  for (const entry of cachedData.tokenUsage || []) {
    const team = getTeamForPerson(entry.name);
    if (team) tokensByTeam[team] = (tokensByTeam[team] || 0) + (entry.input || 0) + (entry.output || 0);
  }

  const snapshot: MetricsSnapshot = {
    timestamp: Date.now(),
    teams: cachedData.teams
      .filter((t: any) => !t.error)
      .map((t: any) => ({
        name: t.name,
        testsPassing:
          (t.testResults?.backend?.passed || 0) +
          (t.testResults?.frontend?.unit?.passed || 0) +
          (t.testResults?.frontend?.e2e?.passed || 0),
        totalCommits: t.totalCommits || 0,
        linesAdded: t.totalLinesAdded || 0,
        mergedPRs: t.mergedPRsCount || 0,
        tokensBurned: tokensByTeam[t.name] || 0,
      })),
  };
  metricsHistory.push(snapshot);
  if (metricsHistory.length > 144) metricsHistory = metricsHistory.slice(-144);
  console.log(`Recorded metrics: ${snapshot.teams.map(t => t.name).join(', ')}`);
  await saveMetricsHistory();
}

setInterval(recordMetricsHistory, 10 * 60 * 1000);

async function fetchGitHub(endpoint: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return response.json();
}

async function fetchGitHubAllPages(endpoint: string): Promise<any[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  const sep = endpoint.includes('?') ? '&' : '?';
  let page = 1;
  const results: any[] = [];
  while (true) {
    const response = await fetch(`https://api.github.com${endpoint}${sep}per_page=100&page=${page}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

async function fetchAnthropicAdmin(endpoint: string) {
  if (!ANTHROPIC_ADMIN_KEY) return null;
  try {
    const response = await fetch(`https://api.anthropic.com${endpoint}`, {
      headers: {
        "x-api-key": ANTHROPIC_ADMIN_KEY,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`Anthropic API error: ${response.status} ${text}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`Anthropic API fetch error:`, error);
    return null;
  }
}

async function fetchTokenUsage() {
  if (!ANTHROPIC_ADMIN_KEY) return [];

  try {
    const keysData = await fetchAnthropicAdmin("/v1/organizations/api_keys?limit=1000");
    if (!keysData) return [];

    const keyIdToName: Record<string, string> = {};
    for (const key of keysData.data || []) {
      keyIdToName[key.id] = key.name;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startingAt = oneDayAgo.toISOString();
    const endingAt = now.toISOString();

    const usageByKey: Record<string, { input: number; output: number; name: string }> = {};
    let nextPage: string | null = null;

    do {
      const pageParam = nextPage ? `&page=${nextPage}` : '';
      const usageData = await fetchAnthropicAdmin(
        `/v1/organizations/usage_report/messages?starting_at=${startingAt}&ending_at=${endingAt}&group_by[]=api_key_id&bucket_width=1h${pageParam}`
      );
      if (!usageData) break;

      for (const bucket of usageData.data || []) {
        for (const result of bucket.results || []) {
          const keyId = result.api_key_id;
          if (!keyId) continue;

          if (!usageByKey[keyId]) {
            usageByKey[keyId] = { input: 0, output: 0, name: keyIdToName[keyId] || keyId };
          }
          usageByKey[keyId].input += result.input_tokens || 0;
          usageByKey[keyId].input += result.input_cached_tokens || 0;
          usageByKey[keyId].output += result.output_tokens || 0;
        }
      }

      nextPage = usageData.has_more ? usageData.next_page : null;
    } while (nextPage);

    return Object.values(usageByKey);
  } catch (error) {
    console.error("Token usage error:", error);
    return [];
  }
}

async function fetchTestResults(repo: string, runId: number) {
  try {
    const artifacts = await fetchGitHub(`/repos/${repo}/actions/runs/${runId}/artifacts`);
    const results: { backend: any; frontend: { unit: any; e2e: any } } = {
      backend: null,
      frontend: { unit: null, e2e: null }
    };

    console.log(`[${repo}] Found ${artifacts.artifacts?.length || 0} artifacts:`, artifacts.artifacts?.map((a: any) => a.name));

    for (const artifact of artifacts.artifacts || []) {
      if (artifact.name === 'backend-test-results' || artifact.name === 'frontend-test-results') {
        try {
          const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
          };
          if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
          }

          const response = await fetch(
            `https://api.github.com/repos/${repo}/actions/artifacts/${artifact.id}/zip`,
            { headers, redirect: 'follow' }
          );

          console.log(`[${repo}] Artifact ${artifact.name} fetch status: ${response.status}`);
          if (!response.ok) {
            console.log(`[${repo}] Artifact error body:`, await response.text());
          }

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const zip = await JSZip.loadAsync(buffer);
            const files = Object.keys(zip.files);
            console.log(`[${repo}] Files in ${artifact.name}:`, files);

            if (artifact.name === 'backend-test-results') {
              const file = zip.file('test-results.json');
              if (file) {
                const content = await file.async('string');
                console.log(`[${repo}] Backend test results:`, content.substring(0, 200));
                results.backend = JSON.parse(content);
              }
            } else {
              const unitFile = zip.file('unit-test-results.json');
              const e2eFile = zip.file('e2e-test-results.json');
              if (unitFile) {
                const content = await unitFile.async('string');
                console.log(`[${repo}] Unit test results:`, content.substring(0, 200));
                results.frontend.unit = JSON.parse(content);
              }
              if (e2eFile) {
                const content = await e2eFile.async('string');
                console.log(`[${repo}] E2E test results:`, content.substring(0, 200));
                results.frontend.e2e = JSON.parse(content);
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch artifact ${artifact.name}:`, e);
        }
      }
    }
    return results;
  } catch (e) {
    console.warn('Failed to fetch test results:', e);
    return { backend: null, frontend: { unit: null, e2e: null } };
  }
}

async function fetchTeamData(team: typeof REPOS[0]) {
  const { repo } = team;

  try {
    const [allCommits, issues, pulls, workflows, rawContributorStats] = await Promise.all([
      fetchGitHubAllPages(`/repos/${repo}/commits`),
      fetchGitHub(`/repos/${repo}/issues?state=all&per_page=100`),
      fetchGitHubAllPages(`/repos/${repo}/pulls?state=all`),
      fetchGitHub(`/repos/${repo}/actions/runs?per_page=1`),
      fetchGitHub(`/repos/${repo}/stats/contributors`).catch(() => []),
    ]);

    const prepIndex = allCommits.findIndex((c: any) => c.sha.startsWith(PREP_COMMIT_SHA));
    const commits = prepIndex === -1 ? allCommits : allCommits.slice(0, prepIndex);

    // Fetch commit stats for all commits
    const allCommitStats = await Promise.all(
      commits.map(async (commit: any) => {
        const avatarUrl = commit.author?.avatar_url || null;
        try {
          const details = await fetchGitHub(`/repos/${repo}/commits/${commit.sha}`);
          return {
            message: commit.commit?.message?.split('\n')[0] || '',
            author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
            authorHandle: commit.author?.login || commit.commit?.author?.name || 'Unknown',
            avatarUrl,
            date: commit.commit?.author?.date,
            additions: details.stats?.additions || 0,
            deletions: details.stats?.deletions || 0,
          };
        } catch {
          return {
            message: commit.commit?.message?.split('\n')[0] || '',
            author: commit.commit?.author?.name || 'Unknown',
            authorHandle: commit.author?.login || 'Unknown',
            avatarUrl,
            date: commit.commit?.author?.date,
            additions: 0,
            deletions: 0,
          };
        }
      })
    );
    const recentCommits = allCommitStats.slice(0, 3);

    // Aggregate contributor stats (additions + deletions) from GitHub's stats API
    const prepCommitDate = allCommits[prepIndex === -1 ? allCommits.length - 1 : prepIndex]?.commit?.author?.date;
    const prepTimestamp = prepCommitDate ? Math.floor(new Date(prepCommitDate).getTime() / 1000) : 0;
    const contributorStats = Array.isArray(rawContributorStats)
      ? rawContributorStats.map((c: any) => ({
          login: c.author?.login,
          additions: (c.weeks || [])
            .filter((w: any) => w.w >= prepTimestamp)
            .reduce((sum: number, w: any) => sum + (w.a || 0), 0),
          deletions: (c.weeks || [])
            .filter((w: any) => w.w >= prepTimestamp)
            .reduce((sum: number, w: any) => sum + (w.d || 0), 0),
        }))
      : [];

    // Minimal commit data for Hall of Fame (all commits)
    const allCommitsMinimal = commits.map((c: any) => ({
      author: c.commit?.author?.name || c.author?.login || 'Unknown',
      authorHandle: c.author?.login || c.commit?.author?.name || 'Unknown',
      avatarUrl: c.author?.avatar_url || null,
      date: c.commit?.author?.date,
    }));

    const openIssuesAll = issues.filter((i: any) => i.state === 'open' && !i.pull_request);
    const closedIssuesAll = issues.filter((i: any) => i.state === 'closed' && !i.pull_request);
    const openPRsAll = pulls.filter((p: any) => p.state === 'open');
    const mergedPRsAll = pulls.filter((p: any) => p.merged_at);

    const lastPush = commits[0]?.commit?.author?.date;
    const buildStatus = workflows.workflow_runs?.[0]?.conclusion ||
                        workflows.workflow_runs?.[0]?.status ||
                        'unknown';

    // Fetch test results from artifacts
    const runId = workflows.workflow_runs?.[0]?.id;
    console.log(`[${repo}] Workflow runId: ${runId}, status: ${buildStatus}`);
    const testResults = runId ? await fetchTestResults(repo, runId) : null;
    console.log(`[${repo}] Test results:`, JSON.stringify(testResults));

    return {
      ...team,
      commits: recentCommits,
      allCommits: allCommitsMinimal,
      allCommitStats,
      openIssues: openIssuesAll.slice(0, 3).map((i: any) => ({ number: i.number, title: i.title, url: i.html_url })),
      openIssuesCount: openIssuesAll.length,
      closedIssuesCount: closedIssuesAll.length,
      allIssues: issues.filter((i: any) => !i.pull_request).map((i: any) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        labels: (i.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
        assignee: i.assignee?.login || null,
        createdAt: i.created_at,
      })),
      openPRs: openPRsAll.slice(0, 3).map((p: any) => ({ number: p.number, title: p.title, url: p.html_url })),
      openPRsCount: openPRsAll.length,
      mergedPRs: mergedPRsAll.map((p: any) => ({ author: p.user?.login || 'Unknown' })),
      mergedPRsCount: mergedPRsAll.length,
      lastPush,
      buildStatus,
      testResults,
      contributorStats,
      totalCommits: commits.length,
      totalLinesAdded: recentCommits.reduce((sum, c) => sum + c.additions, 0),
      totalLinesDeleted: recentCommits.reduce((sum, c) => sum + c.deletions, 0),
      error: null,
    };
  } catch (error: any) {
    return {
      ...team,
      error: error.message,
    };
  }
}

const server = Bun.serve({
  port: 8080,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    console.log(`Request: ${url.pathname}`);

    // Team names mapping endpoints
    if (url.pathname === "/api/team-mapping" && req.method === "GET") {
      return new Response(JSON.stringify(teamNamesMapping), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (url.pathname === "/api/team-mapping" && req.method === "POST") {
      try {
        const body = await req.json() as Record<string, string>;
        teamNamesMapping = body;
        await Bun.write(TEAM_NAMES_FILE, JSON.stringify(teamNamesMapping, null, 2));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Metrics history endpoint
    if (url.pathname === "/api/metrics-history") {
      return new Response(JSON.stringify(metricsHistory), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Main API endpoint - returns all data (cached for 30s)
    if (url.pathname === "/api/data") {
      try {
        const now = Date.now();
        if (!cachedData || now - cacheTimestamp > CACHE_TTL_MS) {
          console.log("Cache miss - fetching fresh data...");
          try {
            const [teamsData, tokenUsage] = await Promise.all([
              Promise.all(REPOS.map(fetchTeamData)),
              fetchTokenUsage(),
            ]);
            cachedData = { teams: teamsData, tokenUsage };
            cacheTimestamp = now;
            recordMetricsHistory();
            await saveDataCache(cachedData);
          } catch (fetchError) {
            console.error("Fetch failed, falling back to disk cache:", fetchError);
            if (!cachedData) {
              const saved = await loadDataCache();
              if (saved) {
                cachedData = saved;
                console.log("Serving stale data from disk cache");
              } else {
                throw fetchError;
              }
            }
          }
        } else {
          console.log(`Cache hit - ${Math.round((CACHE_TTL_MS - (now - cacheTimestamp)) / 1000)}s remaining`);
        }

        return new Response(JSON.stringify(cachedData), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("API error:", error);
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Serve static files
    let path = url.pathname;
    if (path === "/") path = "/index.html";

    const file = Bun.file(import.meta.dir + path);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Dashboard server running at http://localhost:${server.port}`);
