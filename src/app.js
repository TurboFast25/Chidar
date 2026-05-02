const state = {
  roomImageDataUrl: "",
  analysis: null,
  analyzing: false,
};

const els = {
  upload: document.querySelector("#room-upload"),
  analyzeButton: document.querySelector("#analyze-button"),
  resetButton: document.querySelector("#reset-button"),
  toggleOverlay: document.querySelector("#toggle-overlay"),
  dropHint: document.querySelector("#drop-hint"),
  viewer: document.querySelector("#viewer"),
  image: document.querySelector("#room-image"),
  overlay: document.querySelector("#overlay"),
  statusBadge: document.querySelector("#status-badge"),
  summaryPanel: document.querySelector("#summary-panel"),
  guidanceList: document.querySelector("#guidance-list"),
};

attachEvents();
render();

function attachEvents() {
  els.upload.addEventListener("change", handleUpload);
  els.analyzeButton.addEventListener("click", analyzeCurrentRoom);
  els.resetButton.addEventListener("click", resetState);
  els.toggleOverlay.addEventListener("change", renderOverlay);
}

async function handleUpload(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  state.roomImageDataUrl = await readFileAsDataUrl(file);
  state.analysis = null;
  els.image.src = state.roomImageDataUrl;
  render();
}

async function analyzeCurrentRoom() {
  if (!state.roomImageDataUrl || state.analyzing) {
    return;
  }

  state.analyzing = true;
  render();

  try {
    state.analysis = await analyzeRoomImageDataUrl(state.roomImageDataUrl);
  } catch (error) {
    state.analysis = {
      summary: `Analysis failed: ${error.message}`,
      roomType: "",
      cameraView: "",
      floorPolygon: [],
      wallZones: [],
      avoidZones: [],
      placementGuidance: [],
      lighting: "",
      model: "",
    };
  } finally {
    state.analyzing = false;
    render();
  }
}

function resetState() {
  state.roomImageDataUrl = "";
  state.analysis = null;
  state.analyzing = false;
  els.upload.value = "";
  els.image.removeAttribute("src");
  render();
}

function render() {
  const hasImage = Boolean(state.roomImageDataUrl);
  const hasAnalysis = Boolean(state.analysis);

  els.analyzeButton.disabled = !hasImage || state.analyzing;
  els.statusBadge.textContent = state.analyzing ? "Analyzing" : hasAnalysis ? "Mapped" : hasImage ? "Ready" : "Idle";
  els.dropHint.hidden = hasImage;
  els.viewer.hidden = !hasImage;

  if (!hasImage) {
    els.summaryPanel.textContent = "Upload an image to begin.";
    els.guidanceList.innerHTML = "<li>No guidance yet.</li>";
    els.overlay.innerHTML = "";
    return;
  }

  if (!hasAnalysis) {
    els.summaryPanel.innerHTML = '<div class="metric"><strong>Image loaded</strong>Run the analyzer to generate floor, wall, and occupied-zone estimates.</div>';
    els.guidanceList.innerHTML = "<li>Analyze the uploaded room to generate placement guidance.</li>";
    els.overlay.innerHTML = "";
    return;
  }

  renderSummary();
  renderGuidance();
  renderOverlay();
}

function renderSummary() {
  const analysis = state.analysis;
  els.summaryPanel.innerHTML = `
    <div class="metric">
      <strong>Summary</strong>
      ${escapeHtml(analysis.summary || "No summary returned.")}
    </div>
    <div class="metric">
      <strong>Room type</strong>
      ${escapeHtml(analysis.roomType || "Unknown")}
    </div>
    <div class="metric">
      <strong>Camera view</strong>
      ${escapeHtml(analysis.cameraView || "Unknown")}
    </div>
    <div class="metric">
      <strong>Lighting</strong>
      ${escapeHtml(analysis.lighting || "Unknown")}
    </div>
    <div class="metric">
      <strong>Model</strong>
      ${escapeHtml(analysis.model || "Local heuristic")}
    </div>
  `;
}

function renderGuidance() {
  const guidance = state.analysis.placementGuidance || [];
  els.guidanceList.innerHTML = guidance.length
    ? guidance.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>No guidance returned.</li>";
}

function renderOverlay() {
  if (!state.analysis) {
    els.overlay.innerHTML = "";
    return;
  }

  els.overlay.classList.toggle("is-hidden", !els.toggleOverlay.checked);

  const floorPolygon = polygonPoints(state.analysis.floorPolygon || []);
  const wallZones = (state.analysis.wallZones || [])
    .map(
      (zone) => `
        <rect class="wall-zone" x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}"></rect>
        <text class="overlay-label" x="${zone.x + 1.2}" y="${zone.y + 3.4}">${escapeHtml(zone.name)}</text>
      `,
    )
    .join("");
  const avoidZones = (state.analysis.avoidZones || [])
    .map(
      (zone) => `
        <rect class="avoid-zone" x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}"></rect>
        <text class="overlay-label" x="${zone.x + 1.2}" y="${zone.y + 3.4}">${escapeHtml(zone.name)}</text>
      `,
    )
    .join("");

  els.overlay.innerHTML = `
    ${floorPolygon ? `<polygon class="floor-polygon" points="${floorPolygon}"></polygon>` : ""}
    ${wallZones}
    ${avoidZones}
  `;
}

function polygonPoints(points) {
  if (!points.length) {
    return "";
  }
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupOccupiedColumns(occupiedColumns, imageWidth, horizonRow, imageHeight) {
  const groups = [];
  let start = -1;

  for (let index = 0; index <= occupiedColumns.length; index += 1) {
    const occupied = index < occupiedColumns.length ? occupiedColumns[index] : false;
    if (occupied && start === -1) {
      start = index;
      continue;
    }
    if (!occupied && start !== -1) {
      groups.push({ start, end: index - 1 });
      start = -1;
    }
  }

  return groups
    .filter((group) => group.end - group.start >= Math.max(3, Math.round(imageWidth * 0.06)))
    .slice(0, 3)
    .map((group, index) => ({
      name: `occupied zone ${index + 1}`,
      x: clamp((group.start / imageWidth) * 100, 0, 100),
      y: clamp((horizonRow / imageHeight) * 100, 0, 100),
      width: clamp(((group.end - group.start + 1) / imageWidth) * 100, 4, 100),
      height: clamp(((imageHeight - horizonRow) / imageHeight) * 100, 8, 100),
    }));
}

function findHorizonRow(rowBrightness, rowGradients) {
  const start = Math.max(4, Math.floor(rowBrightness.length * 0.28));
  const end = Math.min(rowBrightness.length - 4, Math.floor(rowBrightness.length * 0.78));
  let bestIndex = Math.floor(rowBrightness.length * 0.58);
  let bestScore = -Infinity;

  for (let row = start; row <= end; row += 1) {
    const contrast = rowGradients[row] || 0;
    const below = average(rowBrightness.slice(row, Math.min(rowBrightness.length, row + 6)));
    const above = average(rowBrightness.slice(Math.max(0, row - 6), row));
    const lowerWeight = row / rowBrightness.length;
    const score = contrast + Math.max(0, below - above) * 0.35 + lowerWeight * 8;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = row;
    }
  }

  return bestIndex;
}

function describeLighting(overallBrightness) {
  if (overallBrightness >= 190) {
    return "bright daylight";
  }
  if (overallBrightness >= 145) {
    return "balanced ambient light";
  }
  if (overallBrightness >= 105) {
    return "soft interior light";
  }
  return "dim interior light";
}

function describeRoomType(imageWidth, imageHeight, avoidZones) {
  const aspectRatio = imageWidth / imageHeight;
  if (aspectRatio >= 1.45) {
    return "wide living area";
  }
  if (avoidZones.length >= 2) {
    return "furnished bedroom or lounge";
  }
  if (aspectRatio <= 0.9) {
    return "compact bedroom";
  }
  return "multi-purpose interior room";
}

function describeCameraView(imageWidth, imageHeight, horizonRow) {
  const aspectRatio = imageWidth / imageHeight;
  const horizonPercent = (horizonRow / imageHeight) * 100;

  if (aspectRatio >= 1.4 && horizonPercent >= 50) {
    return "eye-level wide shot";
  }
  if (aspectRatio <= 0.9) {
    return "upright phone capture";
  }
  if (horizonPercent < 45) {
    return "slightly elevated angle";
  }
  return "straight-on interior view";
}

function buildPlacementGuidance(avoidZones, dominantSide, horizonPercent) {
  const guidance = [];

  guidance.push("Keep larger furniture inside the visible floor polygon instead of floating it into wall zones.");
  guidance.push("Preserve a clean walking path through the center floor area.");

  if (avoidZones.length) {
    guidance.push("Avoid overlapping the detected occupied zones when staging new pieces.");
  } else {
    guidance.push("The room appears open enough to center a main seating or bed arrangement.");
  }

  if (dominantSide === "left") {
    guidance.push("The left side appears visually heavier, so bias new placements slightly to the right.");
  } else if (dominantSide === "right") {
    guidance.push("The right side appears visually heavier, so bias new placements slightly to the left.");
  }

  if (horizonPercent >= 60) {
    guidance.push("Favor lower foreground placements because the visible floor depth is shallow.");
  } else {
    guidance.push("Use mid-depth placements to maintain believable perspective.");
  }

  return guidance;
}

async function analyzeRoomImageDataUrl(roomImageDataUrl) {
  if (!roomImageDataUrl) {
    throw new Error("roomImageDataUrl is required");
  }

  const image = await loadImage(roomImageDataUrl);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  if (!imageWidth || !imageHeight) {
    throw new Error("Could not read image dimensions");
  }

  const maxDimension = 160;
  const scale = Math.min(1, maxDimension / Math.max(imageWidth, imageHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(24, Math.round(imageWidth * scale));
  canvas.height = Math.max(24, Math.round(imageHeight * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas is unavailable for local room analysis");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  const rowBrightness = new Array(canvas.height).fill(0);
  const columnEnergy = new Array(canvas.width).fill(0);
  let overallBrightness = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const brightness = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      rowBrightness[y] += brightness;
      overallBrightness += brightness;

      if (x > 0 && y >= Math.floor(canvas.height * 0.45)) {
        const prevIndex = index - 4;
        const previousBrightness =
          data[prevIndex] * 0.299 + data[prevIndex + 1] * 0.587 + data[prevIndex + 2] * 0.114;
        columnEnergy[x] += Math.abs(brightness - previousBrightness);
      }
    }
  }

  overallBrightness /= canvas.width * canvas.height;
  for (let row = 0; row < rowBrightness.length; row += 1) {
    rowBrightness[row] /= canvas.width;
  }

  const rowGradients = rowBrightness.map((value, row) => {
    if (row === 0) {
      return 0;
    }
    return Math.abs(value - rowBrightness[row - 1]);
  });

  const horizonRow = findHorizonRow(rowBrightness, rowGradients);
  const horizonPercent = (horizonRow / canvas.height) * 100;
  const leftEnergy = average(columnEnergy.slice(0, Math.floor(canvas.width / 2)));
  const rightEnergy = average(columnEnergy.slice(Math.floor(canvas.width / 2)));
  const dominantSide = leftEnergy > rightEnergy * 1.1 ? "left" : rightEnergy > leftEnergy * 1.1 ? "right" : "center";
  const energyAverage = average(columnEnergy);
  const occupiedColumns = columnEnergy.map((value, index) => {
    const lowerBand = index > canvas.width * 0.08 && index < canvas.width * 0.92;
    return lowerBand && value > energyAverage * 1.55;
  });

  const avoidZones = groupOccupiedColumns(occupiedColumns, canvas.width, horizonRow, canvas.height);
  const leftInset = dominantSide === "left" ? 18 : 12;
  const rightInset = dominantSide === "right" ? 18 : 12;
  const floorPolygon = [
    { x: leftInset, y: clamp(horizonPercent + 2, 20, 92) },
    { x: 100 - rightInset, y: clamp(horizonPercent + 2, 20, 92) },
    { x: 96, y: 100 },
    { x: 4, y: 100 },
  ];
  const wallTop = 4;
  const wallHeight = clamp(horizonPercent - wallTop, 12, 70);
  const wallZones = [
    { name: "left wall", x: 0, y: wallTop, width: 24, height: wallHeight },
    { name: "back wall", x: 24, y: wallTop, width: 52, height: wallHeight },
    { name: "right wall", x: 76, y: wallTop, width: 24, height: wallHeight },
  ];

  const roomType = describeRoomType(imageWidth, imageHeight, avoidZones);
  const cameraView = describeCameraView(imageWidth, imageHeight, horizonRow);
  const lighting = describeLighting(overallBrightness);
  const placementGuidance = buildPlacementGuidance(avoidZones, dominantSide, horizonPercent);
  const summary = avoidZones.length
    ? `Detected a ${roomType} with ${avoidZones.length} occupied floor zone${avoidZones.length > 1 ? "s" : ""} and a visible back wall.`
    : `Detected a ${roomType} with a mostly open floor area and a visible back wall.`;

  return {
    summary,
    roomType,
    cameraView,
    floorPolygon,
    wallZones,
    avoidZones,
    placementGuidance,
    lighting,
    model: "local-browser-heuristic-v1",
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the selected image."));
    image.src = src;
  });
}
