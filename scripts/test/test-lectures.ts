/**
 * Lecture playback test harness.
 *
 * Runs the real backend chapter parser (`parseChapter`) over fixtures covering
 * every provider TNC chapters use, resolves each to an embeddable URL with the
 * same helper the frontend uses, then verifies the resulting URL is reachable
 * and actually embeddable (no `X-Frame-Options: SAMEORIGIN` / restrictive CSP).
 *
 * Run: npx tsx scripts/src/test-lectures.ts
 */
import { parseChapter } from "../../artifacts/api-server/src/routes/proxy";
import {
  getVideoEmbedUrl,
  resolveVideoId,
  resolveVideoProvider,
} from "../../artifacts/tnc-web/src/lib/video-utils";

type Fixture = {
  name: string;
  chapter: Record<string, unknown>;
  expect: {
    provider: string | null;
    contentType: string;
    firebaseId?: string | null;
    videoUrlIncludes?: string;
  };
};

const FS_UUID = "5f2c1a90-7d3b-4a1e-9c88-2b6f4d1e7a11";

const fixtures: Fixture[] = [
  {
    name: "FastStream fs_id",
    chapter: { _na: "Live Theory 1", _vi: { fs_id: FS_UUID } },
    expect: { provider: "fs", contentType: "firebase", firebaseId: FS_UUID },
  },
  {
    name: "FastStream _fs_id (legacy)",
    chapter: { _na: "Live Theory 2", _de: JSON.stringify({ _vi: { _fs_id: FS_UUID } }) },
    expect: { provider: "fs", contentType: "firebase", firebaseId: FS_UUID },
  },
  {
    name: "Vimeo link",
    chapter: { _na: "Vimeo lecture", _vi: { vimeo: "https://vimeo.com/76979871" } },
    expect: { provider: "vimeo", contentType: "youtube", videoUrlIncludes: "player.vimeo.com/video/76979871" },
  },
  {
    name: "Vimeo _vim_id",
    chapter: { _na: "Vimeo id", _vi: { _vim_id: 76979871 } },
    expect: { provider: "vimeo", contentType: "youtube", videoUrlIncludes: "76979871" },
  },
  {
    name: "YouTube watch URL",
    chapter: { _na: "YouTube lecture", _vi: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
    expect: { provider: "youtube", contentType: "youtube" },
  },
  {
    name: "YouTube short URL",
    chapter: { _na: "YouTube short", _vi: { _vi_url: "https://youtu.be/dQw4w9WgXcQ" } },
    expect: { provider: "youtube", contentType: "youtube" },
  },
  {
    name: "Direct MP4",
    chapter: {
      _na: "Direct mp4",
      _vi: { url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" },
    },
    expect: { provider: "direct", contentType: "youtube", videoUrlIncludes: ".mp4" },
  },
  {
    name: "Direct HLS",
    chapter: { _na: "Direct hls", _vi: { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" } },
    expect: { provider: "direct", contentType: "youtube", videoUrlIncludes: ".m3u8" },
  },
  {
    name: "Firebase storage gs://",
    chapter: {
      _na: "Firebase gs",
      _vi: { url: "gs://team-nursing-classes-818e5.appspot.com/videos/abc.mp4" },
    },
    expect: { provider: "direct", contentType: "youtube", videoUrlIncludes: "media-proxy" },
  },
  {
    name: "PDF only",
    chapter: { _na: "Notes", _de: { _no: "uploads/notes/chapter-1.pdf" } },
    expect: { provider: null, contentType: "pdf" },
  },
];

function makeRow(chapter: Record<string, unknown>) {
  return {
    id: 1,
    row_id: "row-1",
    json: chapter,
    co_refid: "course-1",
    su_refid: "subject-1",
    cr_on: new Date().toISOString(),
  };
}

type Check = { label: string; ok: boolean; detail: string };

async function checkEmbeddable(url: string): Promise<Check> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (lecture-playback-test)" },
    });
    clearTimeout(timer);

    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    const frameAncestors = csp.match(/frame-ancestors\s+([^;]+)/)?.[1]?.trim();

    const blockedByXfo = xfo.includes("sameorigin") || xfo.includes("deny");
    const blockedByCsp = Boolean(frameAncestors) && !frameAncestors!.includes("*");
    const ok = res.status < 400 && !blockedByXfo && !blockedByCsp;

    const detail = [
      `HTTP ${res.status}`,
      xfo ? `XFO=${xfo}` : "XFO=none",
      frameAncestors ? `frame-ancestors=${frameAncestors}` : "frame-ancestors=none",
    ].join(", ");
    return { label: "embeddable", ok, detail };
  } catch (error) {
    return { label: "embeddable", ok: false, detail: (error as Error).message };
  }
}

async function checkDirectVideo(url: string): Promise<Check> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Range: "bytes=0-1023", "User-Agent": "Mozilla/5.0 (lecture-playback-test)" },
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    const ok = (res.status === 200 || res.status === 206) && (ct.includes("video") || ct.includes("mpegurl") || ct.includes("octet-stream"));
    return {
      label: "stream",
      ok,
      detail: `HTTP ${res.status}, content-type=${ct || "none"}`,
    };
  } catch (error) {
    return { label: "stream", ok: false, detail: (error as Error).message };
  }
}

async function main() {
  let failures = 0;
  const rows: string[] = [];

  for (const fixture of fixtures) {
    const session = parseChapter(makeRow(fixture.chapter)) as unknown as {
      videoProvider?: string | null;
      videoId?: string | null;
      videoUrl?: string | null;
      firebaseId?: string | null;
      contentType: string;
    };

    const provider = resolveVideoProvider(session);
    const videoId = resolveVideoId(provider, session);
    const embedUrl = provider ? getVideoEmbedUrl(provider, videoId) : "";

    const parseOk =
      provider === fixture.expect.provider &&
      session.contentType === fixture.expect.contentType &&
      (fixture.expect.firebaseId === undefined || (session.firebaseId ?? null) === fixture.expect.firebaseId) &&
      (!fixture.expect.videoUrlIncludes || (session.videoUrl ?? "").includes(fixture.expect.videoUrlIncludes));

    const checks: Check[] = [{ label: "parse", ok: parseOk, detail: `provider=${provider}, contentType=${session.contentType}, id=${videoId || "-"}` }];

    if (provider === "direct" && session.videoUrl) {
      const url = session.videoUrl.startsWith("/api/") ? `http://localhost:8080${session.videoUrl}` : session.videoUrl;
      if (!url.startsWith("http://localhost")) checks.push(await checkDirectVideo(url));
    } else if (embedUrl) {
      checks.push(await checkEmbeddable(embedUrl));
    }

    const failed = checks.filter((check) => !check.ok);
    if (failed.length) failures += 1;

    rows.push(
      `${failed.length ? "FAIL" : "PASS"}  ${fixture.name.padEnd(26)} ${checks
        .map((check) => `${check.label}: ${check.detail}`)
        .join(" | ")}`,
    );
  }

  console.log("\nLecture playback test results\n" + "=".repeat(110));
  for (const row of rows) console.log(row);
  console.log("=".repeat(110));
  console.log(`${fixtures.length - failures}/${fixtures.length} fixtures passed`);

  process.exit(failures === 0 ? 0 : 1);
}

main();
