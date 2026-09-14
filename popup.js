const slider = document.querySelector("#speedSlider");
const speedValue = document.querySelector("#speedValue");
const customSpeed = document.querySelector("#customSpeed");
const applyButton = document.querySelector("#applyButton");
const status = document.querySelector("#status");
const presetButtons = [...document.querySelectorAll("[data-speed]")];

function normalizeSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return 1;
  return Math.min(32, Math.max(0.25, Math.round(speed * 100) / 100));
}

function updateUi(speed) {
  speedValue.textContent = speed;
  slider.value = speed;
  customSpeed.value = speed;
  presetButtons.forEach((button) => button.classList.toggle("active", Number(button.dataset.speed) === speed));
}

async function setSpeed(value) {
  const speed = normalizeSpeed(value);
  updateUi(speed);
  await chrome.storage.sync.set({ speed });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "SET_SPEED", speed });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"]
      });
      response = await chrome.tabs.sendMessage(tab.id, { type: "SET_SPEED", speed });
    }
    status.textContent = response.videoCount
      ? response.mode === "turbo"
        ? `${speed}x Turbo active (16x + smart skipping)`
        : `${response.videoCount} video${response.videoCount === 1 ? "" : "s"} set to ${speed}x`
      : "No HTML5 video found—refresh this page once";
  } catch (error) {
    status.textContent = "Page access blocked—refresh this tab once";
  }
}

slider.addEventListener("input", () => setSpeed(slider.value));
applyButton.addEventListener("click", () => setSpeed(customSpeed.value));
customSpeed.addEventListener("keydown", (event) => {
  if (event.key === "Enter") setSpeed(customSpeed.value);
});
presetButtons.forEach((button) => button.addEventListener("click", () => setSpeed(button.dataset.speed)));

chrome.storage.sync.get({ speed: 1 }, ({ speed }) => setSpeed(speed));
