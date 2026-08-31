const port = Number(process.argv[2] || 9233);
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((entry) => entry.type === "page");
if (!page) throw new Error("No CDP page target");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  pending.get(message.id)(message);
  pending.delete(message.id);
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: "window.__qaErrors=[];addEventListener('error',e=>__qaErrors.push(String(e.message||e.error)));addEventListener('unhandledrejection',e=>__qaErrors.push(String(e.reason)));"
});
await send("Page.navigate", { url: "http://127.0.0.1:4173/?chapter=2&seed=71" });
await new Promise((resolve) => setTimeout(resolve, 6500));

const expression = `(() => {
  const canvas = document.querySelector("canvas");
  const assetNames = [
    "chapter2-polar-sea-ai-v1.png",
    "chapter2-polar-sea-foreground-ai-v3.png",
    "chapter2-hive-carrier-ai-v1.png",
    "chapter2-enemy-fleet-atlas-ai-v1.png",
    "chapter2-drone-atlas-ai-v1.png",
    "chapter2-abyss-sovereign-ai-v1.png"
  ];
  const resources = performance.getEntriesByType("resource");
  const loaded = Object.fromEntries(assetNames.map((name) => [name, resources.some((entry) => entry.name.endsWith(name) && entry.duration >= 0)]));
  const context = canvas?.getContext("2d");
  const samples = [];
  const waterSamples = [];
  if (context) {
    const stepX = Math.max(1, Math.floor(canvas.width / 8));
    const stepY = Math.max(1, Math.floor(canvas.height / 6));
    for (let y = stepY / 2; y < canvas.height; y += stepY) {
      for (let x = stepX / 2; x < canvas.width; x += stepX) {
        samples.push(Array.from(context.getImageData(x, y, 1, 1).data));
      }
    }
    for (const [xRatio, yRatio] of [[.25, .5], [.75, .5], [.5, .22], [.5, .78], [.36, .38], [.64, .62]]) {
      waterSamples.push(Array.from(context.getImageData(Math.floor(canvas.width * xRatio), Math.floor(canvas.height * yRatio), 1, 1).data));
    }
  }
  return JSON.stringify({
    ready: document.readyState,
    chapter: document.body.dataset.chapter,
    canvas: {
      width: canvas?.width,
      height: canvas?.height,
      dataLength: canvas?.toDataURL().length,
      uniqueSamples: new Set(samples.map(JSON.stringify)).size,
      waterSignature: waterSamples.map((sample) => sample.join(",")).join("|")
    },
    loaded,
    droneMode: document.querySelector("#droneModeText")?.textContent,
    droneModeDisabled: document.querySelector("#droneModeButton")?.disabled,
    techTreeOpen: !document.querySelector("#techTreePanel")?.classList.contains("hidden"),
    errors: window.__qaErrors ?? []
  });
})()`;

const evaluate = async () => {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true });
  return JSON.parse(response.result.result.value);
};
const before = await evaluate();
const buttonResponse = await send("Runtime.evaluate", {
  expression: `(() => { const box = document.querySelector("#droneModeButton").getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; })()`,
  returnByValue: true
});
const point = buttonResponse.result.result.value;
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 1200));
const after = await evaluate();
console.log(JSON.stringify({ before, after }, null, 2));
socket.close();
