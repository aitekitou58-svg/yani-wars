import { totals, palette, duration } from "./core.js";
import { landscapeSvg } from "./landscape.js";

const yen = (n) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(
    Math.round(n * 100) / 100,
  );

// Share the app's public entry point, never the current query/hash or a local preview.
export function publicShareUrl(configured, appBase) {
  try {
    const url = new URL(configured || appBase);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !host.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) ||
      /^(?:0|10|127)\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
      /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
    )
      return null;
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/index\.html$/, "");
    return url.href;
  } catch {
    return null;
  }
}

export function shareContent(events, period, publicUrl, now = new Date()) {
  if (!["today", "all"].includes(period))
    throw Error("シェア期間を確認してください");
  const stats = totals(events, period, now);
  const label = period === "today" ? "今日" : "累計";
  const text = `ヤニウォーズで、${label}${stats.count}本を守った。\n${yen(stats.money)}円 / 寿命換算 ${duration(stats.life)} / 自由時間 ${duration(stats.free)}\n「お前には、もう奪わせない。」\n#ヤニウォーズ`;
  const caption = [text, publicUrl].filter(Boolean).join("\n");
  const data = {
    title: "ヤニウォーズ",
    text,
    ...(publicUrl ? { url: publicUrl } : {}),
  };
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  if (publicUrl) intent.searchParams.set("url", publicUrl);
  return {
    stats,
    label,
    text,
    caption,
    data,
    intent: publicUrl ? intent.href : null,
  };
}

export async function createShareImage(content, totalCount, publicUrl) {
  const t = content.stats,
    p = palette(totalCount),
    canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext("2d");
  c.fillStyle = p.bg;
  c.fillRect(0, 0, 1080, 1350);
  c.fillStyle = p.ink;
  c.font = "bold 35px sans-serif";
  c.fillText("ヤニウォーズ", 80, 100);
  c.font = "22px sans-serif";
  c.fillText("RECLAIM YOUR WORLD", 80, 143);
  c.font = "bold 48px sans-serif";
  c.fillText("お前には、もう奪わせない。", 80, 220);
  c.font = "38px sans-serif";
  c.fillText(`${content.label} ${t.count}本 守った`, 80, 315, 920);
  c.font = "bold 62px sans-serif";
  c.fillText(`${yen(t.money)}円 取り戻した`, 80, 405, 920);
  const sceneUrl = URL.createObjectURL(new Blob([landscapeSvg(totalCount)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(Error("景色を作成できませんでした"));
      image.src = sceneUrl;
    });
    c.drawImage(image, 0, 450, 1080, 648);
  } finally { URL.revokeObjectURL(sceneUrl); }
  c.fillStyle = p.ink;
  c.font = "32px sans-serif";
  c.fillText(`寿命換算  ${duration(t.life)}`, 80, 1160, 920);
  c.fillText(`自由時間  ${duration(t.free)}`, 80, 1220, 920);
  c.font = "24px sans-serif";
  c.fillText(publicUrl ? publicUrl.replace(/^https:\/\//, "").replace(/\/$/, "") : "ヤニウォーズ · 世界を取り戻そう。", 80, 1300, 920);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw Error("画像を作成できませんでした");
  return blob;
}
