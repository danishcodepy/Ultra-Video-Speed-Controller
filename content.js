const DEFAULT_SPEED = 1;
const MIN_SPEED = 0.25;
const MAX_SPEED = 32;
let selectedSpeed = DEFAULT_SPEED;
const MAX_NATIVE_SPEED = 16;
const turboClock = new WeakMap();

function normalizeSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(speed * 100) / 100));
}

function findVideos(root = document) {
  const videos = [...root.querySelectorAll("video")];
  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) videos.push(...findVideos(element.shadowRoot));
  }
  return videos;
}

function applySpeed(speed = selectedSpeed) {
  selectedSpeed = normalizeSpeed(speed);
  const videos = findVideos();
  const nativeSpeed = Math.min(selectedSpeed, MAX_NATIVE_SPEED);

  for (const video of videos) {
    try {
      if (video.playbackRate !== nativeSpeed) video.playbackRate = nativeSpeed;
    } catch {
      // A website may temporarily reject rate changes while its player loads.
    }
    video.dataset.ultraVideoSpeed = String(selectedSpeed);
  }

  return videos.length;
}

chrome.storage.sync.get({ speed: DEFAULT_SPEED }, ({ speed }) => applySpeed(speed));

const observer = new MutationObserver(() => applySpeed());
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("loadedmetadata", (event) => {
  if (event.target instanceof HTMLMediaElement) {
    event.target.playbackRate = Math.min(selectedSpeed, MAX_NATIVE_SPEED);
  }
}, true);

document.addEventListener("ratechange", (event) => {
  const nativeSpeed = Math.min(selectedSpeed, MAX_NATIVE_SPEED);
  if (event.target instanceof HTMLMediaElement && event.target.playbackRate !== nativeSpeed) {
    try { event.target.playbackRate = nativeSpeed; } catch {}
  }
}, true);

// Chromium reliably supports native playback only up to roughly 16x. For higher
// values, keep native playback at 16x and skip the extra timeline distance.
setInterval(() => {
  const now = performance.now();

  for (const video of findVideos()) {
    const previous = turboClock.get(video) ?? now;
    turboClock.set(video, now);

    if (selectedSpeed <= MAX_NATIVE_SPEED || video.paused || video.seeking || video.ended) continue;

    const elapsedSeconds = Math.min((now - previous) / 1000, 0.5);
    const extraSeconds = elapsedSeconds * (selectedSpeed - MAX_NATIVE_SPEED);
    const targetTime = Math.min(video.duration || Infinity, video.currentTime + extraSeconds);

    if (Number.isFinite(targetTime) && targetTime > video.currentTime) {
      try { video.currentTime = targetTime; } catch {}
    }
  }
}, 250);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.speed) applySpeed(changes.speed.newValue);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SET_SPEED") {
    const count = applySpeed(message.speed);
    sendResponse({
      ok: true,
      speed: selectedSpeed,
      videoCount: count,
      mode: selectedSpeed > MAX_NATIVE_SPEED ? "turbo" : "native"
    });
  }

  if (message.type === "GET_STATUS") {
    sendResponse({ ok: true, speed: selectedSpeed, videoCount: findVideos().length });
  }
});
