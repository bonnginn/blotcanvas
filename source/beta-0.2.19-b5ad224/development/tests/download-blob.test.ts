import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { downloadBlob } from "../app/download-blob.ts";

function environment(throwOnClick = false) {
  const pending: {at: number; run: () => void}[] = [];
  const blobs = new Map<string, Blob>();
  let attached = false, clicks = 0;
  const anchor = {href: "", download: "", target: "", rel: "", hidden: false,
    click() { assert.ok(attached, "link is connected at activation"); clicks++; if (throwOnClick) throw new Error("click failed"); },
    remove() { attached = false; }};
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalTimeout = globalThis.setTimeout;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  Object.defineProperty(globalThis, "document", {configurable: true, value: {createElement: () => anchor, body: {appendChild: () => {attached = true;}}}});
  URL.createObjectURL = blob => {assert.ok(blob instanceof Blob); const url = `blob:test/${blobs.size}`; blobs.set(url, blob); return url;};
  URL.revokeObjectURL = url => {blobs.delete(url);};
  globalThis.setTimeout = ((run: () => void, at: number) => {pending.push({run, at}); return 1;}) as typeof setTimeout;
  return {anchor, blobs, pending, clicks: () => clicks, attached: () => attached,
    restore() {URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; globalThis.setTimeout = originalTimeout; if (originalDocument) Object.defineProperty(globalThis,"document",originalDocument); else Reflect.deleteProperty(globalThis,"document");}};
}

test("PNG and ZIP download retain exact bytes through delayed browser resolution and protect the workspace", async () => {
  const env = environment();
  try {
    for (const [name, mime, bytes] of [["Figure.png","image/png",[137,80,78,71]], ["outputs.zip","application/zip",[80,75,3,4]]] as const) {
      const blob = new Blob([new Uint8Array(bytes)], {type: mime});
      downloadBlob(name, blob);
      const url = env.anchor.href;
      assert.equal(env.anchor.download, name);
      assert.equal(env.anchor.target, "_blank"); assert.equal(env.anchor.rel, "noopener");
      assert.equal(env.attached(), false);
      assert.equal(env.blobs.get(url), blob);
      // The old 1-second cleanup invalidated this delayed resolution.
      assert.equal(env.pending.at(-1)?.at, 60_000);
      assert.deepEqual([...new Uint8Array(await env.blobs.get(url)!.arrayBuffer())], [...bytes]);
      env.pending.at(-1)!.run(); assert.equal(env.blobs.has(url), false);
    }
    assert.equal(env.clicks(), 2);
  } finally {env.restore();}
});

test("failed download activation propagates error and still releases DOM and URL", () => {
  const env = environment(true);
  try {
    assert.throws(() => downloadBlob("figure.png",new Blob(["png"])), /click failed/);
    assert.equal(env.attached(), false); env.pending[0].run(); assert.equal(env.blobs.size,0);
  } finally {env.restore();}
});

test("both application save paths use the safe download helper", () => {
  const source = readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  const save = source.slice(source.indexOf("const save ="),source.indexOf("const canvasBlob ="));
  assert.match(save,/downloadBlob\(name, new Blob/);
  assert.match(save,/downloadBlob\(name, blob\)/);
  assert.doesNotMatch(save,/1000|\.click\(/);
});
