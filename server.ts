const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const REPOS = [
  { name: 'Obsidian', repo: 'itenium-be/Bootcamp-AI-Obsidian', color: '#8b5cf6', logo: 'logos/Team-Obsidian.png', frontendPort: 5180 },
  { name: 'RoyalPurple', repo: 'itenium-be/Bootcamp-AI-RoyalPurple', color: '#7851a9', logo: 'logos/Team-RoyalPurple.png', frontendPort: 5181 },
  { name: 'Teal', repo: 'itenium-be/Bootcamp-AI-Teal', color: '#008080', logo: 'logos/Team-Teal.png', frontendPort: 5182 },
  { name: 'Emerald', repo: 'itenium-be/Bootcamp-AI-Emerald', color: '#50c878', logo: 'logos/Team-Emerald.png', frontendPort: 5183 },
  { name: 'Crimson', repo: 'itenium-be/Bootcamp-AI-Crimson', color: '#dc143c', logo: 'logos/Team-Crimson.png', frontendPort: 5184 },
  { name: 'MidnightBlue', repo: 'itenium-be/Bootcamp-AI-MidnightBlue', color: '#6366f1', logo: 'logos/Team-MidnightBlue.png', frontendPort: 5185 },
];

const PREP_COMMIT_SHA = '731e4ad50e34e6587258a6a67ceeb895e10b5366';

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

async function fetchAnthropicAdmin(endpoint: string) {
  if (!ANTHROPIC_ADMIN_KEY) return null;
  const response = await fetch(`https://api.anthropic.com${endpoint}`, {
    headers: {
      "x-api-key": ANTHROPIC_ADMIN_KEY,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    console.error(`Anthropic API error: ${response.status} ${await response.text()}`);
    return null;
  }
  return response.json();
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

async function fetchTeamData(team: typeof REPOS[0]) {
  const { repo } = team;

  try {
    const [allCommits, issues, pulls, workflows] = await Promise.all([
      fetchGitHub(`/repos/${repo}/commits?per_page=50`),
      fetchGitHub(`/repos/${repo}/issues?state=all&per_page=100`),
      fetchGitHub(`/repos/${repo}/pulls?state=all&per_page=100`),
      fetchGitHub(`/repos/${repo}/actions/runs?per_page=1`),
    ]);

    // Filter out prep commits
    const prepIndex = allCommits.findIndex((c: any) => c.sha.startsWith(PREP_COMMIT_SHA));
    const commits = prepIndex === -1 ? allCommits : allCommits.slice(0, prepIndex);

    // Fetch commit stats for recent commits
    const commitsWithStats = await Promise.all(
      commits.slice(0, 3).map(async (commit: any) => {
        try {
          const details = await fetchGitHub(`/repos/${repo}/commits/${commit.sha}`);
          return { ...commit, stats: details.stats };
        } catch {
          return { ...commit, stats: null };
        }
      })
    );

    const openIssues = issues.filter((i: any) => i.state === 'open' && !i.pull_request);
    const closedIssues = issues.filter((i: any) => i.state === 'closed' && !i.pull_request);
    const openPRs = pulls.filter((p: any) => p.state === 'open');
    const mergedPRs = pulls.filter((p: any) => p.merged_at);

    const lastPush = commits[0]?.commit?.author?.date;
    const buildStatus = workflows.workflow_runs?.[0]?.conclusion ||
                        workflows.workflow_runs?.[0]?.status ||
                        'unknown';

    return {
      ...team,
      commits: commitsWithStats,
      allCommits: commits,
      openIssues,
      closedIssues,
      openPRs,
      mergedPRs,
      lastPush,
      buildStatus,
      totalCommits: commits.length,
      totalLinesAdded: commitsWithStats.reduce((sum: number, c: any) => sum + (c.stats?.additions || 0), 0),
      totalLinesDeleted: commitsWithStats.reduce((sum: number, c: any) => sum + (c.stats?.deletions || 0), 0),
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

    // Main API endpoint - returns all data
    if (url.pathname === "/api/data") {
      try {
        const [teamsData, tokenUsage] = await Promise.all([
          Promise.all(REPOS.map(fetchTeamData)),
          fetchTokenUsage(),
        ]);

        return new Response(JSON.stringify({ teams: teamsData, tokenUsage }), {
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
