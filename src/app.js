import {
  dayKey,
  totals,
  palette,
  recovery,
  duration,
  makeEvent,
  priceAt,
  craving,
} from "./core.js";
import { boot, mutate, persist, erase, storageStatus } from "./storage.js";
import { publicShareUrl, shareContent, createShareImage } from "./sharing.js";
import { landscapeSvg } from "./landscape.js";
const $ = (s) => document.querySelector(s);
const app = $("#app");
const dialog = $("#dialog");
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const yen = (n) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(
    Math.round(n * 100) / 100,
  );
let state,
  config,
  catalog,
  view = "home",
  period = "today",
  selected,
  tone = "praise",
  category = "all",
  busy = false,
  noticeTimer,
  launchMessage = "";
const channel =
  "BroadcastChannel" in window ? new BroadcastChannel("yani-sync") : null;
const leaf =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 25C3 10 13 4 27 5c0 15-7 24-20 20Z" fill="currentColor"/><path d="m8 24 12-12" stroke="var(--bg)" fill="none" stroke-width="1.6"/></svg>';
function scene() {
  const count = totals(state.events).count;
  return `<div class="landscape" aria-hidden="true">${landscapeSvg(count)}<span class="scene-caption">${String(count).padStart(3, "0")} &nbsp; / &nbsp; 世界を育てている</span></div>`;
}

function theme() {
  const p = palette(totals(state.events).count);
  for (const k of ["bg", "ink", "green", "hill", "sky"])
    document.documentElement.style.setProperty(`--${k}`, p[k]);
  document.documentElement.style.setProperty("--grain", 1 - p.progress * 0.85);
  $("meta[name=theme-color]").content = p.bg;
}
function notify(text) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = text;
  $("#notice").classList.add("show");
  noticeTimer = setTimeout(() => $("#notice").classList.remove("show"), 3200);
}
function modal(html) {
  dialog.innerHTML = `<button class="close" aria-label="閉じる">×</button>${html}`;
  dialog.querySelector(".close").onclick = () => dialog.close();
  dialog.showModal();
}
function header() {
  return `<header><a class="wordmark" href="#home">${leaf}ヤニウォーズ</a><span class="edition">RECLAIM YOUR WORLD</span></header>`;
}
function nav() {
  return `<nav aria-label="メイン"><button data-view="home" ${view === "home" ? 'aria-current="page"' : ""}>ホーム</button><button data-view="history" ${view === "history" ? 'aria-current="page"' : ""}>記録</button><button data-view="settings" ${view === "settings" ? 'aria-current="page"' : ""}>設定</button></nav>`;
}
function stats(t) {
  return `<div class="money"><span>取り戻したお金</span><div><small>¥</small><strong>${yen(t.money)}</strong></div></div><div class="time-stats"><div><span>寿命換算 <button class="info" data-action="medical" aria-label="寿命換算の説明">i</button></span><strong>${duration(t.life)}</strong></div><div><span>自由時間</span><strong>${duration(t.free)}</strong></div></div>`;
}
function render() {
  theme();
  if (!state.settings) {
    onboarding();
    return;
  }
  const total = totals(state.events),
    today = totals(state.events, "today");
  app.innerHTML = `<div class="shell">${header()}<main>${view === "home" ? `<section class="home"><div class="heading"><p class="eyebrow">ONE LESS. MORE LIFE.</p><h1>お前には、<br>もう奪わせない。</h1><p class="quiet">${launchMessage || "その1本から、取り戻そう。"}</p></div>${scene()}<div class="count-line"><span>今日守った <strong id="today-count">${today.count}</strong> 本</span><span>累計 <b>${total.count}</b> 本</span></div><div class="action-area"><button class="save-button" id="save">吸わなかった！<span aria-hidden="true">＋</span></button><button class="smoked" id="smoked">吸った</button></div><section class="reclaimed" aria-label="累計の成果">${stats(total)}</section><div class="share-actions" role="group" aria-label="成果をシェア"><button class="share-link" data-action="share"><span>今日の成果をシェア</span><span aria-hidden="true">↗</span></button><button class="share-link" data-action="share-all"><span>今までの成果をシェア</span><span aria-hidden="true">↗</span></button></div><p class="world-copy">奪われていたものを取り戻すほど、<br>世界に色が戻る。</p></section>` : view === "history" ? history() : settings()}</main>${nav()}</div>`;
  bind();
}
function history() {
  const t = totals(state.events, period);
  return `<section class="page"><p class="eyebrow">EVERY LITTLE VICTORY</p><h1>取り戻したもの。</h1><div class="tabs" role="group" aria-label="集計期間">${[
    ["today", "今日"],
    ["week", "今週"],
    ["all", "累計"],
  ]
    .map(
      ([key, label]) =>
        `<button data-period="${key}" aria-pressed="${period === key}">${label}</button>`,
    )
    .join(
      "",
    )}</div><p class="record-count"><strong>${t.count}</strong> 本を守った</p>${stats(t)}<h2>最近の記録</h2><div class="event-list">${
    state.events
      .slice(-30)
      .reverse()
      .map(
        (e) =>
          `<div><span>${new Date(e.at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><b>${e.type === "saved" ? `1本守った <small>＋${yen(e.unitPrice)}円</small>` : "喫煙時刻を記録"}</b></div>`,
      )
      .join("") ||
    '<p class="quiet">最初の1本から、ここに積み重なっていきます。</p>'
  }</div><p class="footnote">今週は月曜日から。日付は記録時の端末の現地日付です。表示は直近30件、集計はすべての記録を含みます。</p></section>`;
}
function settings() {
  return `<section class="page"><p class="eyebrow">YOUR OWN PACE</p><h1>あなたのペースで。</h1><div class="setting-row"><span>吸っている銘柄</span><button id="change-product">${escape(state.settings.product.name)} <span>›</span></button><small>現在 1本 ${yen(priceAt(state.settings.product))}円</small></div><div class="setting-row"><label for="tone">アプリの語り口</label><select id="tone"><option value="praise" ${state.settings.tone === "praise" ? "selected" : ""}>褒める</option><option value="tease" ${state.settings.tone === "tease" ? "selected" : ""}>煽る</option></select></div><div class="setting-row"><label for="minutes">1本の喫煙時間（分）</label><div class="minute-options">${[3, 5, 7, 10].map((n) => `<button data-minutes="${n}" aria-pressed="${state.settings.freeMinutes === n}">${n}分</button>`).join("")}</div><form id="time-form"><input id="minutes" type="number" min="1" max="120" step="1" required value="${state.settings.freeMinutes}" aria-label="自由入力（分）"><button class="text-button">保存</button></form><small>変更は次の記録から適用。過去の金額・寿命換算・時間は変わりません。</small></div><div class="setting-row"><h2>データ状態</h2><p>記録 ${state.events.length}件 · この端末に保存</p><small>${escape(storageStatus.backup)}<br>保存領域の保護：${storageStatus.persistent ? "有効" : "ブラウザの管理に従います"}</small><button class="text-button" id="export">記録をファイルに保存</button><small>自動バックアップも同じ端末内です。端末紛失・ブラウザのデータ消去からは復元できません。</small></div>${[
    ["install", "ホーム画面に追加"],
    ["medical", "医学的根拠"],
    ["privacy", "プライバシー"],
  ]
    .map(
      ([a, t]) =>
        `<button class="setting-link" data-action="${a}">${t}<span>↗</span></button>`,
    )
    .join(
      "",
    )}<button class="delete" id="delete">すべての記録を削除</button><p class="footnote">ヤニウォーズ v1.0<br>お前には、もう奪わせない。</p></section>`;
}
function productPicker() {
  return `<label class="search-label" for="search">銘柄を検索</label><input id="search" type="search" placeholder="メビウス、テリア、ケント…" autocomplete="off"><div class="filters">${[
    ["all", "すべて"],
    ["paper", "紙巻き"],
    ["IQOS", "IQOS"],
    ["Ploom", "Ploom"],
    ["glo", "glo"],
    ["other", "その他"],
  ]
    .map(
      ([k, v]) =>
        `<button data-category="${k}" aria-pressed="${category === k}">${v}</button>`,
    )
    .join(
      "",
    )}</div><div id="products" class="products"></div><details class="manual"><summary>一覧にない銘柄を入力</summary><label>商品名<input id="manual-name" maxlength="100" placeholder="商品名"></label><div class="two-fields"><label>箱価格（円）<input id="manual-price" type="number" min="1" max="100000"></label><label>入り数<input id="manual-count" type="number" min="1" max="1000" value="20"></label></div><button id="manual-select" class="text-button">この銘柄を選ぶ</button></details><div id="selection" class="selection"></div><p class="footnote">公式資料で確認した商品を掲載。一部未掲載・販売状況未確認の商品があります。価格確認：${escape(catalog.checkedAt || "商品ごとの情報を参照")}</p>`;
}
function onboarding() {
  app.innerHTML = `<div class="shell onboarding">${header()}<main><p class="eyebrow">WELCOME TO YOUR WORLD</p><h1>世界を、<br>取り戻そう。</h1><p class="intro">吸いたいと思った。でも、吸わなかった。<br>その1回から、お金も、時間も、色も。</p><section><p class="step">01 <span>吸っている銘柄</span></p>${productPicker()}</section><section><p class="step">02 <span>どんな言葉で、一緒に進む？</span></p><div class="tone-choices"><button data-tone="tease" aria-pressed="${tone === "tease"}"><b>煽る</b><span>「その1本、本当にいる？」</span></button><button data-tone="praise" aria-pressed="${tone === "praise"}"><b>褒める</b><span>「次の1本も取り戻そう。」</span></button></div></section><button class="save-button start" id="start" ${selected ? "" : "disabled"}>ヤニウォーズを始める <span>→</span></button><p class="footnote">登録不要。記録は、この端末の中だけに。</p></main></div>`;
  bindPicker();
  document.querySelectorAll("[data-tone]").forEach(
    (b) =>
      (b.onclick = () => {
        tone = b.dataset.tone;
        document
          .querySelectorAll("[data-tone]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }),
  );
  $("#start").onclick = async () => {
    if (!selected) return;
    await commit((s) => {
      s.settings = {
        product: selected,
        tone,
        freeMinutes: config.defaultFreeMinutes,
      };
      return s;
    });
    await persist();
  };
}
function listProducts() {
  const normalize = (s) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .replace(/[\s・･ー−-]/g, "");
  const q = normalize($("#search").value);
  const products = catalog.products.filter(
    (p) =>
      p.status !== "discontinued" &&
      (!p.effectiveFrom || p.effectiveFrom <= dayKey(new Date())) &&
      (category === "all" ||
        (category === "paper"
          ? p.type === "paper" || p.type === "紙巻き"
          : category === "other"
            ? !["IQOS", "Ploom", "glo"].includes(p.category) &&
              p.type !== "paper" &&
              p.type !== "紙巻き"
            : p.category === category)) &&
      normalize(
        `${p.name} ${p.manufacturer} ${p.category} ${(p.aliases || []).join(" ")}`,
      ).includes(q),
  );
  $("#products").innerHTML =
    products
      .slice(0, 40)
      .map(
        (p) =>
          `<button data-product="${escape(p.id)}" aria-pressed="${selected?.id === p.id}"><span>${escape(p.name)}<small>${escape(p.category)} · ${p.count}本入り${p.status === "approved" ? " · 販売状況未確認" : ""}</small></span><b>${yen(p.packPrice)}<small>円</small></b></button>`,
      )
      .join("") ||
    '<p class="quiet">該当する銘柄がありません。下から入力できます。</p>';
  document
    .querySelectorAll("[data-product]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          choose(catalog.products.find((p) => p.id === b.dataset.product))),
    );
}
function choose(p) {
  selected = p;
  $("#selection").innerHTML =
    `<span>選択中</span><b>${escape(p.name)}</b><span>${yen(p.packPrice)}円 / ${p.count}本 · 1本 ${yen(priceAt(p))}円</span>${p.status === "approved" ? "<span>認可価格・現在の販売状況は未確認</span>" : ""}`;
  if ($("#start")) $("#start").disabled = false;
  if ($("#apply-product")) $("#apply-product").disabled = false;
  listProducts();
}
function bindPicker() {
  listProducts();
  if (selected) choose(selected);
  $("#search").oninput = listProducts;
  document.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        document
          .querySelectorAll("[data-category]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        listProducts();
      }),
  );
  $("#manual-select").onclick = () => {
    const name = $("#manual-name").value.trim(),
      packPrice = Number($("#manual-price").value),
      count = Number($("#manual-count").value);
    if (
      !name ||
      !Number.isFinite(packPrice) ||
      packPrice < 1 ||
      packPrice > 100000 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 1000
    ) {
      notify("商品名・価格・入り数を確認してください");
      return;
    }
    choose({
      id: `manual-${crypto.randomUUID()}`,
      name,
      packPrice,
      count,
      category: "手動入力",
      type: "other",
      status: "manual",
      prices: [],
    });
  };
}
let pendingSave = Promise.resolve();
function commit(fn) {
  const next = pendingSave.then(() => commitNow(fn));
  pendingSave = next.catch(() => {});
  return next;
}
async function commitNow(fn) {
  busy = true;
  try {
    state = await mutate(fn);
    channel?.postMessage("changed");
    render();
  } catch (e) {
    notify(`保存できませんでした。${e.message}`);
  } finally {
    busy = false;
  }
}
function bind() {
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        render();
        window.scrollTo(0, 0);
      }),
  );
  $(".wordmark").onclick = (e) => {
    e.preventDefault();
    view = "home";
    render();
  };
  document.querySelectorAll("[data-period]").forEach(
    (b) =>
      (b.onclick = () => {
        period = b.dataset.period;
        render();
      }),
  );
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  if ($("#save"))
    $("#save").onclick = async (e) => {
      const x = e.clientX || innerWidth / 2,
        y = e.clientY || innerHeight / 2;
      let recorded;
      await commit((s) => {
        if (!s.settings) throw Error("初回設定をやり直してください");
        recorded = makeEvent("saved", s.settings, config);
        s.events.push(recorded);
        return s;
      });
      if (recorded && state.events.some((v) => v.id === recorded.id)) {
        const n = totals(state.events).count;
        notify(
          config.milestones.includes(n)
            ? `${n}本。世界が、また少し澄んだ。`
            : `＋1本　＋${yen(recorded.unitPrice)}円　寿命換算 ＋${recorded.lifeMinutes}分　自由時間 ＋${recorded.freeMinutes}分`,
        );
        const ripple = document.createElement("div");
        ripple.className = `ripple ${config.milestones.includes(n) ? "milestone" : ""}`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.append(ripple);
        setTimeout(() => ripple.remove(), 1000);
        $("#today-count")?.animate(
          [
            { opacity: 0.2, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 350,
          },
        );
      }
    };
  if ($("#smoked"))
    $("#smoked").onclick = async () => {
      let id;
      await commit((s) => {
        if (!s.settings) throw Error("初回設定が必要です");
        const e = makeEvent("smoked", s.settings, config);
        id = e.id;
        s.events.push(e);
        return s;
      });
      if (state.events.some((e) => e.id === id))
        notify("最終喫煙時刻を更新しました");
    };
  if (view === "settings") {
    $("#tone").onchange = (e) =>
      commit((s) => {
        s.settings.tone = e.target.value;
        return s;
      });
    const setMinutes = (n) => {
      if (!Number.isInteger(n) || n < 1 || n > 120) {
        notify("1〜120分で入力してください");
        return;
      }
      commit((s) => {
        s.settings.freeMinutes = n;
        return s;
      });
    };
    $("#time-form").onsubmit = (e) => {
      e.preventDefault();
      setMinutes(Number($("#minutes").value));
    };
    document
      .querySelectorAll("[data-minutes]")
      .forEach(
        (b) => (b.onclick = () => setMinutes(Number(b.dataset.minutes))),
      );
    $("#change-product").onclick = () => {
      selected = state.settings.product;
      category = "all";
      modal(
        `<h2>銘柄を変更</h2>${productPicker()}<button class="save-button" id="apply-product">この銘柄に変更</button>`,
      );
      bindPicker();
      $("#apply-product").onclick = async () => {
        await commit((s) => {
          s.settings.product = selected;
          return s;
        });
        dialog.close();
      };
    };
    $("#delete").onclick = () => {
      modal(
        '<h2>本当にすべて削除しますか？</h2><p>吸わなかった記録、金額、寿命換算、色の回復、設定、自動バックアップを含めて削除され、元に戻せません。</p><button class="danger-button" id="confirm-delete">すべて削除する</button><button class="text-button" id="cancel-delete">キャンセル</button>',
      );
      $("#cancel-delete").onclick = () => dialog.close();
      $("#confirm-delete").onclick = async () => {
        if (busy) return;
        busy = true;
        try {
          await erase();
          state = await boot();
          selected = null;
          tone = "praise";
          category = "all";
          view = "home";
          launchMessage = "";
          channel?.postMessage("changed");
          dialog.close();
          render();
          notify("すべての記録を削除しました");
        } catch (e) {
          notify(`削除できませんでした。${e.message}`);
        } finally {
          busy = false;
        }
      };
    };
    $("#export").onclick = () =>
      download(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        `yani-wars-${dayKey(new Date())}.json`,
      );
  }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function action(name) {
  if (name === "medical")
    modal(
      '<p class="eyebrow">ABOUT THE ESTIMATE</p><h2>寿命換算について</h2><p>研究上の集団平均を元にした推計であり、個人の寿命が実際にこの時間延びることを保証するものではありません。</p><p>初期値は1本＝20分。英国の紙巻きたばこ喫煙者の集団データを再評価した Jackson ら（2025, Addiction）の推計を参考にしています。</p><p>加熱式にも、成果を可視化する共通の換算値として適用しています。加熱式1本の健康影響を20分と示す研究根拠ではありません。吸わなかった1本ごとの健康効果を測る機能ではありません。</p><a href="https://discovery.ucl.ac.uk/id/eprint/10203237/" target="_blank" rel="noreferrer">研究原文（UCL） ↗</a><h2>景色の育ち方</h2><p>守った20本を1日相当、1か月を30日として換算します。実際の禁煙日数や身体の回復状態を示すものではありません。</p><p>禁煙後の一般的な変化（WHO・NHS）を参考に、最初の数日相当で黄ばみが抜け、2週間相当で透明感が増し、1〜9か月相当で木や花が育つ演出にしています。</p><p>20分で心拍・血圧が低下、8時間で一酸化炭素濃度が低下、48〜72時間で味覚・嗅覚や呼吸の改善、2〜12週間で血行や肺機能の改善、1〜9か月で咳や息切れの軽減が報告されています。時期や変化には個人差があります。</p><p>「2週間で凝固が正常化」「9か月で繊毛が生えそろう」と全員に断定できる記述は採用していません。途中で吸っても、累計の成果と景色は維持します。加熱式の回復速度を測定する機能ではありません。</p><a href="https://www.who.int/europe/news-room/fact-sheets/item/effects-of-tobacco-on-health" target="_blank" rel="noreferrer">WHO：禁煙による健康上の変化 ↗</a><p><a href="https://111.wales.nhs.uk/LiveWell/QuitSmokingTimeline/" target="_blank" rel="noreferrer">NHS：禁煙後の変化 ↗</a></p>',
    );
  if (name === "privacy")
    modal(
      '<p class="eyebrow">ONLY ON YOUR DEVICE</p><h2>記録は、あなたのもの。</h2><p>氏名・メール・位置情報は取得しません。アカウント、広告、アクセス解析、外部AIも使用しません。</p><p>銘柄、喫煙時刻、成果、設定は端末内に保存します。ユーザー共通の商品マスターとアプリの静的ファイルのみ通信で取得します。通常の配信に伴い、ホスティング事業者がIPアドレスなどを処理する場合があります。</p><p>シェア画像は端末内で生成。銘柄や喫煙時刻は含めません。共有先を選んだ場合のみ、そのアプリへ画像を渡します。</p>',
    );
  if (name === "install")
    modal(
      "<h2>ホーム画面へ。</h2><p>iPhone：Safariで開き、共有メニューから「ホーム画面に追加」を選択。</p><p>Android：Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」。</p><p>最初にオンラインで開いた後は、ホーム画面からオフラインでも記録できます。HTTPSで公開されたURLでお使いください。</p>",
    );
  if (name === "share") share("today");
  if (name === "share-all") share("all");
}
async function copyShareText(text) {
  try {
    if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    notify("コピーしました");
  } catch {
    $("#share-copy-fallback").hidden = false;
    $("#share-copy-text").value = text;
    $("#share-copy-text").focus();
    $("#share-copy-text").select();
    notify("表示された文章を選択してコピーしてください");
  }
}
async function share(initialPeriod = "today") {
  const publicUrl = publicShareUrl(
    config.publicUrl,
    new URL("../", import.meta.url).href,
  );
  const events = structuredClone(state.events);
  let previewUrl,
    blob,
    file,
    content,
    generation = 0,
    ready = false;
  modal(`<h2 id="share-heading">今日、取り戻したもの。</h2>
    <div class="tabs share-periods" role="group" aria-label="シェアする期間">
      <button data-share-period="today" aria-pressed="true">今日</button>
      <button data-share-period="all" aria-pressed="false">累計</button>
    </div>
    <img class="share-preview" alt="シェア画像を準備しています" hidden>
    <button class="save-button" id="share-file" disabled>画像とリンクをシェア <span>↗</span></button>
    <div class="share-options">
      <button id="share-x" ${publicUrl ? "" : "disabled"}>Xに投稿する ↗</button>
      <button id="share-download" disabled>画像を保存</button>
      <button id="share-copy-caption" disabled>投稿文をコピー</button>
      <button id="share-copy-url" ${publicUrl ? "" : "disabled"}>URLをコピー</button>
    </div>
    <p class="share-hint">${publicUrl ? "Instagramなどへは共有メニューから。URLはコピーしてストーリーズのリンクスタンプに貼れます。" : "公開後はアプリのURLも一緒にシェアできます。今は画像と投稿文を使えます。"}</p>
    <p class="share-hint">Xのボタンは投稿文とURLを開きます。画像は保存して添付できます。</p>
    <div id="share-copy-fallback" hidden><label for="share-copy-text">コピーする文章</label><textarea id="share-copy-text" readonly rows="6"></textarea></div>`);
  dialog.addEventListener(
    "close",
    () => {
      generation++;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    { once: true },
  );
  const updatePreview = async (period) => {
    ready = false;
    const token = ++generation;
    document
      .querySelectorAll("[data-share-period]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.sharePeriod === period),
        ),
      );
    [
      "#share-file",
      "#share-download",
      "#share-copy-caption",
      "#share-x",
      "#share-copy-url",
    ].forEach((s) => ($(s).disabled = true));
    $("#share-copy-fallback").hidden = true;
    const nextContent = shareContent(events, period, publicUrl);
    $("#share-heading").textContent = `${nextContent.label}、取り戻したもの。`;
    try {
      const nextBlob = await createShareImage(
        nextContent,
        totals(events).count,
        publicUrl,
      );
      if (token !== generation || !dialog.open) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      content = nextContent;
      blob = nextBlob;
      file = new File([blob], `yani-wars-${period}.png`, { type: "image/png" });
      previewUrl = URL.createObjectURL(blob);
      const img = dialog.querySelector(".share-preview");
      img.src = previewUrl;
      img.alt = `${content.label}の成果：${content.stats.count}本、${yen(content.stats.money)}円`;
      img.hidden = false;
      ["#share-file", "#share-download", "#share-copy-caption"].forEach(
        (s) => ($(s).disabled = false),
      );
      $("#share-file").innerHTML = publicUrl
        ? "画像とリンクをシェア <span>↗</span>"
        : "画像をシェア <span>↗</span>";
      $("#share-x").disabled = !publicUrl;
      $("#share-copy-url").disabled = !publicUrl;
      ready = true;
    } catch (e) {
      if (token === generation) notify(e.message);
    }
  };
  document
    .querySelectorAll("[data-share-period]")
    .forEach((b) => (b.onclick = () => updatePreview(b.dataset.sharePeriod)));
  $("#share-download").onclick = () => {
    if (ready) download(blob, file.name);
  };
  $("#share-copy-caption").onclick = () => {
    if (ready) copyShareText(content.caption);
  };
  $("#share-copy-url").onclick = () => {
    if (ready && publicUrl) copyShareText(publicUrl);
  };
  $("#share-x").onclick = () => {
    if (ready && content.intent)
      window.open(content.intent, "_blank", "noopener,noreferrer");
  };
  $("#share-file").onclick = async () => {
    if (!ready) return;
    const data = { ...content.data, files: [file] };
    try {
      if (
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share(data);
      } else {
        download(blob, file.name);
        if (publicUrl)
          notify("画像を保存しました。投稿文とURLはコピーボタンから使えます");
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      download(blob, file.name);
      notify("画像を保存しました。投稿文とURLはコピーボタンから使えます");
    }
  };
  await updatePreview(initialPeriod);
}

async function start() {
  try {
    [config, catalog, state] = await Promise.all([
      fetch("./config.json").then((r) => r.json()),
      fetch("./data/products.json").then((r) => r.json()),
      boot(),
    ]);
    if (state.settings) {
      const current = catalog.products.find(
        (p) => p.id === state.settings.product.id,
      );
      if (
        current &&
        JSON.stringify(current) !== JSON.stringify(state.settings.product)
      )
        state = await mutate((s) => {
          s.settings.product = current;
          return s;
        });
      if (craving(state.events))
        launchMessage =
          state.settings.tone === "tease"
            ? "その1本、本当にいる？"
            : "次の1本も取り戻そう。";
    }
    render();
    if (storageStatus.recovered)
      notify("自動バックアップから記録を復元しました");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("./sw.js")
        .catch(() => notify("オフラインの準備ができませんでした"));
    navigator.storage
      ?.persisted?.()
      .then((v) => (storageStatus.persistent = v))
      .catch(() => {});
  } catch (e) {
    app.innerHTML = `<main class="fatal"><h1>記録を守るため、<br>読み込みを止めました。</h1><p>${escape(e.message)}</p><button onclick="location.reload()">再読み込み</button><p>初回は通信できる状態で開いてください。</p></main>`;
  }
}
channel?.addEventListener("message", async () => {
  state = await boot();
  if (!state.settings) {
    selected = null;
    tone = "praise";
    category = "all";
  }
  render();
});
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && state) {
    state = await boot();
    if (state.settings && craving(state.events))
      launchMessage =
        state.settings.tone === "tease"
          ? "来たか？"
          : "ここまでちゃんと守れてる。";
    else launchMessage = "";
    render();
  }
});
setInterval(() => {
  if (state?.settings && document.visibilityState === "visible" && !dialog.open)
    render();
}, 60000);
start();
