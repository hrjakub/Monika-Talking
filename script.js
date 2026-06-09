const canvas = document.getElementById("visualizer");
const audio = document.getElementById("audioTrack");
const playToggle = document.getElementById("playToggle");
const statusText = document.getElementById("statusText");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpi = Math.max(window.devicePixelRatio || 1, 1);

let audioContext = null;
let analyser = null;
let sourceNode = null;
let frequencyData = null;
let timeData = null;

let smoothedEnergy = 0.08;
let smoothedBass = 0.05;
let smoothedVoice = 0.08;
let smoothedAir = 0.06;
let isReady = false;

const TAU = Math.PI * 2;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpi = Math.max(window.devicePixelRatio || 1, 1);

  canvas.width = Math.floor(width * dpi);
  canvas.height = Math.floor(height * dpi);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ease(current, target, strength) {
  return current + (target - current) * strength;
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function ensureAudioGraph() {
  if (audioContext) {
    return;
  }

  audioContext = new window.AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.9;

  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
  isReady = true;
}

function sampleBand(startRatio, endRatio) {
  if (!frequencyData) {
    return 0;
  }

  const start = Math.floor(startRatio * frequencyData.length);
  const end = Math.max(start + 1, Math.floor(endRatio * frequencyData.length));
  let total = 0;

  for (let i = start; i < end; i += 1) {
    total += frequencyData[i];
  }

  return total / (end - start) / 255;
}

function updateAudioState() {
  if (!isReady) {
    smoothedEnergy = ease(smoothedEnergy, 0.11, 0.04);
    smoothedBass = ease(smoothedBass, 0.07, 0.05);
    smoothedVoice = ease(smoothedVoice, 0.09, 0.05);
    smoothedAir = ease(smoothedAir, 0.06, 0.05);
    return;
  }

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);

  const bass = sampleBand(0.0, 0.06);
  const lowMids = sampleBand(0.06, 0.18);
  const presence = sampleBand(0.18, 0.38);
  const air = sampleBand(0.38, 0.75);

  const voiceEnergy = lowMids * 0.82 + presence * 1.08 + air * 0.28;
  const combinedEnergy = bass * 0.5 + voiceEnergy * 1.15 + air * 0.22;

  smoothedBass = ease(smoothedBass, bass, 0.12);
  smoothedVoice = ease(smoothedVoice, voiceEnergy, 0.11);
  smoothedAir = ease(smoothedAir, air, 0.1);
  smoothedEnergy = ease(smoothedEnergy, combinedEnergy, 0.1);
}

function getWaveValue(normalizedIndex) {
  if (!timeData) {
    return 0;
  }

  const dataIndex = Math.floor(normalizedIndex * (timeData.length - 1));
  return (timeData[dataIndex] - 128) / 128;
}

function getFrequencyValue(normalizedIndex) {
  if (!frequencyData) {
    return 0;
  }

  const exactIndex = wrap01(normalizedIndex) * (frequencyData.length - 1);
  const left = Math.floor(exactIndex);
  const right = Math.min(left + 1, frequencyData.length - 1);
  const mix = exactIndex - left;
  const value = frequencyData[left] * (1 - mix) + frequencyData[right] * mix;
  return value / 255;
}

function drawBackground(centerX, centerY, pulse) {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createRadialGradient(
    centerX,
    centerY,
    10,
    centerX,
    centerY,
    Math.max(width, height) * 0.65
  );
  background.addColorStop(0, `rgba(24, 41, 77, ${0.76 + pulse * 0.03})`);
  background.addColorStop(0.36, "rgba(11, 27, 48, 0.9)");
  background.addColorStop(1, "rgba(6, 15, 27, 0.99)");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const tealBloom = ctx.createRadialGradient(
    centerX - width * 0.12,
    centerY - height * 0.14,
    0,
    centerX - width * 0.12,
    centerY - height * 0.14,
    Math.min(width, height) * 0.28
  );
  tealBloom.addColorStop(0, `rgba(93, 214, 221, ${0.12 + pulse * 0.03})`);
  tealBloom.addColorStop(1, "rgba(93, 214, 221, 0)");
  ctx.fillStyle = tealBloom;
  ctx.fillRect(0, 0, width, height);

  const coralBloom = ctx.createRadialGradient(
    centerX + width * 0.15,
    centerY + height * 0.12,
    0,
    centerX + width * 0.15,
    centerY + height * 0.12,
    Math.min(width, height) * 0.22
  );
  coralBloom.addColorStop(0, `rgba(255, 155, 136, ${0.075 + pulse * 0.02})`);
  coralBloom.addColorStop(1, "rgba(255, 155, 136, 0)");
  ctx.fillStyle = coralBloom;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.fillStyle = `rgba(129, 142, 255, ${0.05 + pulse * 0.03})`;
  ctx.arc(centerX, centerY, Math.min(width, height) * (0.205 + pulse * 0.01), 0, TAU);
  ctx.fill();
}

function drawCoreGlow(centerX, centerY, radius, pulse) {
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.18, centerX, centerY, radius * 1.06);
  gradient.addColorStop(0, `rgba(151, 177, 255, ${0.16 + pulse * 0.05})`);
  gradient.addColorStop(0.42, `rgba(85, 113, 214, ${0.14 + pulse * 0.04})`);
  gradient.addColorStop(0.72, `rgba(37, 57, 104, ${0.1 + pulse * 0.03})`);
  gradient.addColorStop(1, "rgba(16, 27, 49, 0)");

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(centerX, centerY, radius * 1.06, 0, TAU);
  ctx.fill();
}

function drawBaseRing(centerX, centerY, radius, pulse) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const ringGradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  ringGradient.addColorStop(0, `rgba(111, 227, 223, ${0.22 + pulse * 0.04})`);
  ringGradient.addColorStop(0.55, `rgba(120, 172, 255, ${0.18 + pulse * 0.04})`);
  ringGradient.addColorStop(1, `rgba(255, 157, 136, ${0.14 + pulse * 0.03})`);

  ctx.beginPath();
  ctx.strokeStyle = ringGradient;
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(120, 172, 255, 0.12)";
  ctx.arc(centerX, centerY, radius * 0.99, 0, TAU);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = `rgba(160, 180, 255, ${0.08 + pulse * 0.02})`;
  ctx.lineWidth = 0.8;
  ctx.arc(centerX, centerY, radius * 0.9, 0, TAU);
  ctx.stroke();

  ctx.restore();
}

function buildRingPoints({
  centerX,
  centerY,
  baseRadius,
  amplitude,
  time,
  phase,
  detail,
  voiceWeight,
  rippleWeight,
}) {
  const points = [];
  const count = 168;

  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const angle = t * TAU + phase;
    const wave = isReady ? getWaveValue(wrap01(t + phase / TAU)) : 0;
    const freq = getFrequencyValue(t * 0.46 + 0.02);
    const voiceShape = 0.45 + 0.55 * (0.5 + Math.sin(angle * 2 - time * 0.28) * 0.5);
    const harmonic =
      Math.sin(angle * 3 + time * 0.42) * detail * 0.62 +
      Math.cos(angle * 5 - time * 0.27) * detail * 0.28;
    const audioLift =
      wave * amplitude * 0.24 +
      freq * amplitude * 0.22 +
      smoothedVoice * amplitude * voiceWeight * voiceShape +
      smoothedBass * amplitude * 0.12;

    const radius = baseRadius + harmonic * rippleWeight + audioLift;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }

  return points;
}

function traceSmoothClosedPath(points) {
  if (!points.length) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  ctx.closePath();
}

function drawWaveformRing({
  centerX,
  centerY,
  baseRadius,
  amplitude,
  time,
  phase,
  lineWidth,
  alpha,
  glow,
  colorA,
  colorB,
  colorMid,
  detail,
  voiceWeight,
  rippleWeight,
}) {
  const points = buildRingPoints({
    centerX,
    centerY,
    baseRadius,
    amplitude,
    time,
    phase,
    detail,
    voiceWeight,
    rippleWeight,
  });

  traceSmoothClosedPath(points);

  const stroke = ctx.createLinearGradient(centerX - baseRadius, centerY - baseRadius, centerX + baseRadius, centerY + baseRadius);
  stroke.addColorStop(0, colorA);
  stroke.addColorStop(0.45, colorMid);
  stroke.addColorStop(1, colorB);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowBlur = glow;
  ctx.shadowColor = colorMid;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawSoftHalo(centerX, centerY, radius, pulse, time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < 3; i += 1) {
    const haloRadius = radius * (0.84 + i * 0.06);
    const arcLength = Math.PI * (1.38 + i * 0.08);
    const start = time * (0.07 + i * 0.015) + i * 1.2;

    ctx.beginPath();
    ctx.strokeStyle =
      i === 2
        ? `rgba(255, 157, 136, ${0.08 + pulse * 0.02})`
        : `rgba(${i === 0 ? "108, 231, 226" : "166, 140, 255"}, ${0.1 + pulse * 0.03})`;
    ctx.lineWidth = i === 1 ? 1.35 : 0.95;
    ctx.arc(centerX, centerY, haloRadius, start, start + arcLength);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAccentArc(centerX, centerY, radius, pulse, time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.beginPath();
  ctx.strokeStyle = `rgba(255, 156, 136, ${0.14 + pulse * 0.04})`;
  ctx.lineWidth = 2.2;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "rgba(255, 156, 136, 0.28)";
  ctx.arc(centerX, centerY, radius * 1.01, time * 0.1 + 0.74, time * 0.1 + 1.56);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function render() {
  const time = performance.now() * 0.001;
  updateAudioState();

  const idleMotion = 0.06 + Math.sin(time * 0.85) * 0.018;
  const pulse = clamp(smoothedVoice * 0.52 + smoothedBass * 0.18 + smoothedAir * 0.12 + idleMotion, 0.05, 0.82);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.215;

  drawBackground(centerX, centerY, pulse);
  drawCoreGlow(centerX, centerY, radius, pulse);
  drawBaseRing(centerX, centerY, radius, pulse);
  drawSoftHalo(centerX, centerY, radius, pulse, time);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  drawWaveformRing({
    centerX,
    centerY,
    baseRadius: radius - 2,
    amplitude: 10 + pulse * 18,
    time,
    phase: time * 0.1,
    lineWidth: 1.2,
    alpha: 0.32,
    glow: 16,
    colorA: "rgba(123, 223, 220, 0.7)",
    colorMid: "rgba(153, 150, 255, 0.58)",
    colorB: "rgba(255, 159, 138, 0.42)",
    detail: 3.2,
    voiceWeight: 0.58,
    rippleWeight: 0.66,
  });

  drawWaveformRing({
    centerX,
    centerY,
    baseRadius: radius,
    amplitude: 14 + pulse * 24,
    time,
    phase: time * 0.12 + 0.35,
    lineWidth: 2.5,
    alpha: 0.92,
    glow: 24,
    colorA: "rgba(115, 229, 225, 0.98)",
    colorMid: "rgba(111, 169, 255, 0.96)",
    colorB: "rgba(177, 145, 255, 0.92)",
    detail: 4.4,
    voiceWeight: 0.78,
    rippleWeight: 0.72,
  });

  drawWaveformRing({
    centerX,
    centerY,
    baseRadius: radius + 4,
    amplitude: 11 + pulse * 20,
    time,
    phase: -time * 0.08 + 1.1,
    lineWidth: 1.4,
    alpha: 0.48,
    glow: 18,
    colorA: "rgba(154, 146, 255, 0.62)",
    colorMid: "rgba(108, 198, 255, 0.56)",
    colorB: "rgba(255, 160, 140, 0.44)",
    detail: 3.9,
    voiceWeight: 0.64,
    rippleWeight: 0.58,
  });

  ctx.restore();
  drawAccentArc(centerX, centerY, radius, pulse, time);

  window.requestAnimationFrame(render);
}

async function togglePlayback() {
  try {
    ensureAudioGraph();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  } catch (error) {
    statusText.textContent = "Playback blocked";
    console.error(error);
  }
}

function syncUi() {
  const playing = !audio.paused;
  playToggle.setAttribute("aria-pressed", String(playing));
  playToggle.querySelector(".play-label").textContent = playing ? "Pause Voice" : "Play Voice";

  if (audio.ended) {
    statusText.textContent = "Finished";
  } else if (playing) {
    statusText.textContent = "Playing";
  } else if (audio.currentTime > 0) {
    statusText.textContent = "Paused";
  } else {
    statusText.textContent = "Ready";
  }
}

window.addEventListener("resize", resizeCanvas);
playToggle.addEventListener("click", togglePlayback);
audio.addEventListener("play", syncUi);
audio.addEventListener("pause", syncUi);
audio.addEventListener("ended", syncUi);

resizeCanvas();
syncUi();
render();
