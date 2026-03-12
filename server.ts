const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;

if (!ANTHROPIC_ADMIN_KEY) {
  console.error("Missing ANTHROPIC_ADMIN_KEY environment variable");
  process.exit(1);
}

async function fetchAnthropicAdmin(endpoint: string) {
  const response = await fetch(`https://api.anthropic.com${endpoint}`, {
    headers: {
      "x-api-key": ANTHROPIC_ADMIN_KEY!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const server = Bun.serve({
  port: 8080,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // API endpoint for token usage
    if (url.pathname === "/api/usage") {
      try {
        // Fetch API keys to get name -> id mapping
        const keysData = await fetchAnthropicAdmin("/v1/organizations/api_keys?limit=1000");

        // Build a map of key ID to key name
        const keyIdToName: Record<string, string> = {};
        for (const key of keysData.data || []) {
          keyIdToName[key.id] = key.name;
        }

        // Fetch usage report grouped by API key for the last 24 hours
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const startingAt = oneDayAgo.toISOString();
        const endingAt = now.toISOString();

        // Aggregate usage per API key (handle pagination)
        const usageByKey: Record<string, { input: number; output: number; name: string }> = {};
        let nextPage: string | null = null;

        do {
          const pageParam = nextPage ? `&page=${nextPage}` : '';
          const usageData = await fetchAnthropicAdmin(
            `/v1/organizations/usage_report/messages?starting_at=${startingAt}&ending_at=${endingAt}&group_by[]=api_key_id&bucket_width=1h${pageParam}`
          );

          // Each bucket has a results array with the grouped data
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

        return new Response(JSON.stringify({ usage: Object.values(usageByKey) }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("Usage API error:", error);
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
