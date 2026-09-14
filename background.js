const STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 20, 24, 30, 32];

function nextSpeed(current, direction) {
  if (direction > 0) return STEPS.find((speed) => speed > current) ?? 32;
  return [...STEPS].reverse().find((speed) => speed < current) ?? 0.25;
}

chrome.commands.onCommand.addListener(async (command) => {
  const { speed = 1 } = await chrome.storage.sync.get("speed");
  let updatedSpeed = speed;

  if (command === "speed-up") updatedSpeed = nextSpeed(Number(speed), 1);
  if (command === "speed-down") updatedSpeed = nextSpeed(Number(speed), -1);
  if (command === "speed-reset") updatedSpeed = 1;

  await chrome.storage.sync.set({ speed: updatedSpeed });
});
