import { validState } from './core.js';
export function mergeRecords(current, incoming) {
  if (!validState(incoming) || !validState(current)) throw Error('ヤニウォーズの有効な記録ファイルではありません');
  const events = new Map(current.events.map(e => [e.id, e]));
  for (const e of incoming.events) {
    const old = events.get(e.id);
    if (old && ['type','at','day','unitPrice','lifeMinutes','freeMinutes','productId'].some(k => old[k] !== e[k])) throw Error('同じ記録IDに異なる内容があります。読み込みを中止しました');
    if (!old) events.set(e.id, e);
  }
  return { ...current, settings: current.settings || incoming.settings, events: [...events.values()].sort((a,b) => Date.parse(a.at)-Date.parse(b.at)) };
}
