import { initialState, validState } from "./core.js";
const DB = "yani-wars-v1";
let backupQueue = Promise.resolve();
export const storageStatus = {
  backup: "確認中",
  persistent: false,
  recovered: false,
};
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error("ほかのタブを閉じてもう一度お試しください"));
  });
}
export async function read() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state");
    const r = tx.objectStore("state").get("main");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
async function change(fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    let next;
    const r = store.get("main");
    r.onsuccess = () => {
      try {
        next = fn(r.result);
        if (!validState(next)) throw Error("保存データを検証できません");
        store.put(next, "main");
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || Error("保存を中断しました"));
    };
  });
}
async function dir() {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(
    "yani-backups",
    { create: true },
  );
}
async function digest(payload) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function envelope(state) {
  const payload = JSON.stringify(state);
  return JSON.stringify({ payload, checksum: await digest(payload) });
}
export async function decode(text) {
  const x = JSON.parse(text);
  if ((await digest(x.payload)) !== x.checksum)
    throw Error("バックアップの整合性エラー");
  const state = JSON.parse(x.payload);
  if (!validState(state)) throw Error("バックアップ形式エラー");
  return state;
}
async function snapshots(d) {
  const names = [];
  for await (const [name] of d.entries())
    if (/^snapshot-.*\.json$/.test(name)) names.push(name);
  return names.sort().reverse();
}
async function backup(state) {
  if (!navigator.storage?.getDirectory) {
    storageStatus.backup = "このブラウザは自動バックアップ非対応";
    return;
  }
  try {
    const d = await dir();
    const latest = (await snapshots(d))[0];
    if (latest) {
      try {
        const previous = await decode(
          await (await (await d.getFileHandle(latest)).getFile()).text(),
        );
        if (JSON.stringify(previous) === JSON.stringify(state)) {
          storageStatus.backup = "3世代まで自動保存";
          return;
        }
      } catch {
        /* A damaged latest generation must not block a fresh valid backup. */
      }
    }
    const name = `snapshot-${String(state.revision).padStart(12, "0")}-${crypto.randomUUID()}.json`;
    const h = await d.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(await envelope(state));
    await w.close();
    await decode(await (await h.getFile()).text());
    for (const old of (await snapshots(d)).slice(3)) await d.removeEntry(old);
    storageStatus.backup = "3世代まで自動保存";
  } catch {
    storageStatus.backup = "自動バックアップを保存できませんでした";
  }
}
async function locked(fn) {
  return navigator.locks?.request
    ? navigator.locks.request("yani-data", fn)
    : fn();
}
export async function mutate(fn) {
  return locked(async () => {
    const s = await change((old) => {
      if (old && !validState(old))
        throw Error("記録に問題があります。再起動してください");
      const next = fn(structuredClone(old || initialState()));
      next.revision = (old?.revision || 0) + 1;
      return next;
    });
    backupQueue = backupQueue.catch(() => {}).then(() => backup(s));
    await backupQueue;
    return s;
  });
}
export async function boot() {
  return locked(async () => {
    let s;
    try {
      s = await read();
    } catch (e) {
      throw Error(
        "記録領域を開けません。ほかのタブを閉じて再読み込みしてください。",
        { cause: e },
      );
    }
    if (s && validState(s)) {
      await backup(s);
      return s;
    }
    let recovered;
    let hadBackups = false;
    if (navigator.storage?.getDirectory) {
      try {
        const d = await dir();
        const names = await snapshots(d);
        hadBackups = names.length > 0;
        for (const name of names) {
          try {
            recovered = await decode(
              await (await (await d.getFileHandle(name)).getFile()).text(),
            );
            break;
          } catch {}
        }
      } catch {}
    }
    if (recovered) {
      await change(() => recovered);
      storageStatus.recovered = true;
      storageStatus.backup = "自動バックアップから復元しました";
      return recovered;
    }
    if (s || hadBackups)
      throw Error(
        "記録の破損を検出しました。復元できるバックアップがありません。データの上書きを停止しています。",
      );
    return initialState();
  });
}
export async function persist() {
  try {
    storageStatus.persistent =
      (await navigator.storage?.persisted?.()) ||
      (await navigator.storage?.persist?.()) ||
      false;
  } catch {}
  return storageStatus.persistent;
}
export async function erase() {
  return locked(async () => {
    await backupQueue.catch(() => {});
    if (navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory();
      try {
        await root.removeEntry("yani-backups", { recursive: true });
      } catch (e) {
        if (e.name !== "NotFoundError") throw e;
      }
    }
    await new Promise((resolve, reject) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = resolve;
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        reject(Error("ほかのタブを閉じて削除をやり直してください"));
    });
  });
}
