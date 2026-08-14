type AquariumMode = "roster" | "inspect" | "history" | "benchmarks";

type AquariumRequest = {
  mode?: AquariumMode;
  guid?: number;
  connection?: {
    url?: string;
    user?: string;
    password?: string;
  };
};

const PREFIX = "ALTBO_JSON ";
const COMMANDS: Record<AquariumMode, string> = {
  roster: ".strictbots aquarium roster",
  inspect: ".strictbots aquarium inspect",
  history: ".strictbots aquarium history",
  benchmarks: ".strictbots aquarium benchmarks",
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos);/gi,
    (entity, decimal, hexadecimal) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return (
        {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
        } as Record<string, string>
      )[entity.toLowerCase()];
    },
  );
}

function soapText(xml: string, tag: "result" | "faultstring"): string | null {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    "i",
  );
  const match = xml.match(pattern);
  return match ? decodeXml(match[1]) : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: AquariumRequest;
  try {
    body = (await request.json()) as AquariumRequest;
  } catch {
    return jsonResponse({ ok: false, error: "That request was not valid JSON." }, 400);
  }

  const mode = body.mode;
  const connection = body.connection;
  if (!mode || !COMMANDS[mode] || !connection) {
    return jsonResponse({ ok: false, error: "Missing Aquarium connection details." }, 400);
  }

  let url: URL;
  try {
    url = new URL(connection.url ?? "");
  } catch {
    return jsonResponse({ ok: false, error: "The SOAP address is not a valid URL." }, 400);
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname)) {
    return jsonResponse(
      { ok: false, error: "Aquarium only connects to a loopback HTTP address." },
      400,
    );
  }

  if (!connection.user || !connection.password) {
    return jsonResponse({ ok: false, error: "Enter the SOAP account and password." }, 400);
  }

  if ((mode === "inspect" || mode === "history") && !Number.isInteger(body.guid)) {
    return jsonResponse({ ok: false, error: "Select an altbot first." }, 400);
  }

  const command = `${COMMANDS[mode]}${body.guid ? ` ${body.guid}` : ""}`;
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:ns1="urn:AC"><SOAP-ENV:Body><ns1:executeCommand><command>' +
    escapeXml(command) +
    "</command></ns1:executeCommand></SOAP-ENV:Body></SOAP-ENV:Envelope>";

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${connection.user}:${connection.password}`)}`,
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: envelope,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: `Cannot reach ${url.origin}. Is worldserver running with SOAP enabled?`,
      },
      503,
    );
  }

  const xml = await response.text();
  if (response.status === 401) {
    return jsonResponse({ ok: false, error: "SOAP refused that account or password." }, 401);
  }
  if (response.status === 403) {
    return jsonResponse({ ok: false, error: "The SOAP account needs administrator level 3." }, 403);
  }

  const output = soapText(xml, "result") ?? soapText(xml, "faultstring");
  if (output === null) {
    return jsonResponse({ ok: false, error: "Worldserver returned an unfamiliar SOAP reply." }, 502);
  }

  const line = output
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .findLast((candidate) => candidate.startsWith(PREFIX));
  if (!line) {
    const shortReply = output.trim().slice(0, 240);
    return jsonResponse(
      {
        ok: false,
        error: shortReply || "The Aquarium command is not available on this worldserver build.",
      },
      502,
    );
  }

  try {
    const data = JSON.parse(line.slice(PREFIX.length)) as Record<string, unknown>;
    if (data.error) {
      return jsonResponse({ ok: false, error: String(data.error), data }, 409);
    }
    return jsonResponse({ ok: true, data });
  } catch {
    return jsonResponse({ ok: false, error: "The Aquarium snapshot was not valid JSON." }, 502);
  }
}
