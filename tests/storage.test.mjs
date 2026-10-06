import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { initialState, makeEvent } from "../src/core.js";
const files = new Map();
let unavailable = false;
const directory = {
  async *entries() {
    yield* files.entries();
  },
  async getFileHandle(name, { create } = {}) {
    if (!files.has(name)) {
      if (!create) throw new DOMException("missing", "NotFoundError");
      files.set(name, "");
    }
    return {
      async createWritable() {
        let value;
        return {
          async write(v) {
            if (unavailable) throw Error("quota");
            value = v;
          },
          async close() {
            files.set(name, value);
          },
        };
      },
      async getFile() {
        return { text: async () => files.get(name) };
      },
    };
  },
  async removeEntry(name) {
    files.delete(name);
  },
};
Object.defineProperty(navigator, "storage", {
  value: {
    getDirectory: async () => ({
      getDirectoryHandle: async () => directory,
      removeEntry: async () => files.clear(),
    }),
    persist: async () => true,
    persisted: async () => false,
  },
  configurable: true,
});
const { boot, mutate, read, erase, envelope, decode, storageStatus } =
  await import("../src/storage.js");
const product = { id: "x", name: "x", packPrice: 600, count: 20 };
test("IndexedDB, OPFS generations, recovery, integrity and complete erase", async () => {
  await erase();
  assert.equal((await boot()).settings, null);
  await mutate((s) => {
    s.settings = { product, tone: "praise", freeMinutes: 5 };
    return s;
  });
  for (let i = 0; i < 5; i++)
    await mutate((s) => {
      s.events.push(
        makeEvent("saved", s.settings, { lifeMinutesPerStick: 20 }),
      );
      return s;
    });
  assert.equal((await read()).events.length, 5);
  assert.equal((await boot()).events.length, 5);
  assert.equal(files.size, 3);
  const generations = [...files.keys()].sort();
  await boot();
  await boot();
  assert.deepEqual(
    [...files.keys()].sort(),
    generations,
    "read-only launches must preserve prior generations",
  );
  const serialized = await envelope(await read());
  assert.equal((await decode(serialized)).events.length, 5);
  await assert.rejects(() => decode(serialized.replace("600", "601")));
  await new Promise((resolve, reject) => {
    const r = indexedDB.open("yani-wars-v1", 1);
    r.onsuccess = () => {
      const db = r.result,
        tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put({ bad: true }, "main");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = reject;
    };
  });
  assert.equal((await boot()).events.length, 5);
  assert.equal(storageStatus.recovered, true);
  unavailable = true;
  await mutate((s) => {
    s.events.push(makeEvent("smoked", s.settings, {}));
    return s;
  });
  assert.equal((await read()).events.length, 6);
  assert.match(storageStatus.backup, /保存できません/);
  unavailable = false;
  await erase();
  assert.equal(await read(), undefined);
  assert.equal(files.size, 0);
  assert.deepEqual(await boot(), initialState());
  files.set("snapshot-000000000100-corrupt.json", "damaged");
  await assert.rejects(() => boot(), /復元できるバックアップがありません/);
  assert.equal(
    files.size,
    1,
    "unrecoverable backups must never be overwritten with a fresh state",
  );
  await erase();
});
