const state = {
  roomImageDataUrl: "",
  sourceFile: null,
  sourceFileInfo: null,
  analysis: null,
  analyzing: false,
  calibrationMode: false,
  calibrationPoints: [],
  scaleCalibration: null,
  roomModel: null,
  view: {
    yaw: -18,
    pitch: 34,
    zoom: 100,
  },
};

const els = {
  upload: document.querySelector("#room-upload"),
  analyzeButton: document.querySelector("#analyze-button"),
  resetButton: document.querySelector("#reset-button"),
  toggleOverlay: document.querySelector("#toggle-overlay"),
  startCalibration: document.querySelector("#start-calibration"),
  referenceLabel: document.querySelector("#reference-label"),
  referenceHeight: document.querySelector("#reference-height"),
  dropHint: document.querySelector("#drop-hint"),
  viewer: document.querySelector("#viewer"),
  image: document.querySelector("#room-image"),
  overlay: document.querySelector("#overlay"),
  statusBadge: document.querySelector("#status-badge"),
  calibrationBadge: document.querySelector("#calibration-badge"),
  modelBadge: document.querySelector("#model-badge"),
  fileBadge: document.querySelector("#file-badge"),
  filePanel: document.querySelector("#file-panel"),
  summaryPanel: document.querySelector("#summary-panel"),
  guidanceList: document.querySelector("#guidance-list"),
  modelCanvas: document.querySelector("#model-canvas"),
  yawControl: document.querySelector("#yaw-control"),
  pitchControl: document.querySelector("#pitch-control"),
  zoomControl: document.querySelector("#zoom-control"),
  exportJson: document.querySelector("#export-json"),
  exportObj: document.querySelector("#export-obj"),
  sceneOutput: document.querySelector("#scene-output"),
};

attachEvents();
render();

function attachEvents() {
  els.upload.addEventListener("change", handleUpload);
  els.analyzeButton.addEventListener("click", analyzeCurrentRoom);
  els.resetButton.addEventListener("click", resetState);
  els.toggleOverlay.addEventListener("change", renderOverlay);
  els.startCalibration.addEventListener("click", beginCalibration);
  els.overlay.addEventListener("click", handleOverlayClick);
  els.yawControl.addEventListener("input", handleViewChange);
  els.pitchControl.addEventListener("input", handleViewChange);
  els.zoomControl.addEventListener("input", handleViewChange);
  els.exportJson.addEventListener("click", exportSceneJson);
  els.exportObj.addEventListener("click", exportSceneObj);
}

async function handleUpload(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  const preview = await createPreviewUrl(file);
  const fileInfo = await inspectSourceFile(file);
  state.sourceFile = file;
  state.sourceFileInfo = fileInfo;
  state.roomImageDataUrl = preview;
  state.analysis = null;
  state.roomModel = null;
  state.scaleCalibration = null;
  state.calibrationPoints = [];
  state.calibrationMode = false;
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
    state.roomModel = buildRoomModel(state.analysis, state.scaleCalibration);
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
    state.roomModel = null;
  } finally {
    state.analyzing = false;
    render();
  }
}

function resetState() {
  state.roomImageDataUrl = "";
  state.sourceFile = null;
  state.sourceFileInfo = null;
  state.analysis = null;
  state.analyzing = false;
  state.calibrationMode = false;
  state.calibrationPoints = [];
  state.scaleCalibration = null;
  state.roomModel = null;
  els.upload.value = "";
  els.image.removeAttribute("src");
  render();
}

function render() {
  const hasImage = Boolean(state.roomImageDataUrl);
  const hasAnalysis = Boolean(state.analysis);

  els.analyzeButton.disabled = !hasImage || state.analyzing;
  els.startCalibration.disabled = !hasImage;
  els.exportJson.disabled = !state.roomModel;
  els.exportObj.disabled = !state.roomModel;
  els.statusBadge.textContent = state.analyzing ? "Analyzing" : hasAnalysis ? "Mapped" : hasImage ? "Ready" : "Idle";
  els.calibrationBadge.textContent = state.scaleCalibration ? "Calibrated" : state.calibrationMode ? "Select points" : "Uncalibrated";
  els.modelBadge.textContent = state.roomModel ? "Usable scene" : hasAnalysis ? "Needs calibration" : "Waiting for analysis";
  els.fileBadge.textContent = state.sourceFileInfo ? state.sourceFileInfo.kindLabel : "No file";
  els.dropHint.hidden = hasImage;
  els.viewer.hidden = !hasImage;

  if (!hasImage) {
    renderFilePanel();
    els.summaryPanel.textContent = "Upload an image to begin.";
    els.guidanceList.innerHTML = "<li>No guidance yet.</li>";
    els.overlay.innerHTML = "";
    els.sceneOutput.textContent = "No scene model yet.";
    renderModelCanvas();
    return;
  }

  if (!hasAnalysis) {
    renderFilePanel();
    els.summaryPanel.innerHTML = '<div class="metric"><strong>Image loaded</strong>Run the analyzer to generate floor, wall, and occupied-zone estimates.</div>';
    els.guidanceList.innerHTML = "<li>Analyze the uploaded room to generate placement guidance.</li>";
    els.overlay.innerHTML = "";
    els.sceneOutput.textContent = "Analyze the image to generate a room scene payload.";
    renderModelCanvas();
    return;
  }

  renderFilePanel();
  renderSummary();
  renderGuidance();
  renderOverlay();
  renderSceneOutput();
  renderModelCanvas();
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
    <div class="metric">
      <strong>Scale</strong>
      ${escapeHtml(formatScaleSummary())}
    </div>
  `;
}

function renderFilePanel() {
  const info = state.sourceFileInfo;
  if (!info) {
    els.filePanel.textContent = "Upload an original iPhone HEIC file to inspect depth-related metadata.";
    return;
  }

  els.filePanel.innerHTML = `
    <div class="metric">
      <strong>Filename</strong>
      ${escapeHtml(info.name)}
    </div>
    <div class="metric">
      <strong>Format</strong>
      <code>${escapeHtml(info.kindLabel)}</code>
    </div>
    <div class="metric">
      <strong>Size</strong>
      ${escapeHtml(formatBytes(info.sizeBytes))}
    </div>
    <div class="metric">
      <strong>Depth hint</strong>
      ${escapeHtml(info.depthStatus)}
    </div>
    <div class="metric">
      <strong>Embedded signals</strong>
      ${escapeHtml(info.signals.length ? info.signals.join(", ") : "No depth/disparity signatures detected in browser scan.")}
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
  const calibrationMarkup = renderCalibrationMarkup();

  els.overlay.innerHTML = `
    ${floorPolygon ? `<polygon class="floor-polygon" points="${floorPolygon}"></polygon>` : ""}
    ${wallZones}
    ${avoidZones}
    ${calibrationMarkup}
  `;
}

function renderCalibrationMarkup() {
  if (!state.calibrationPoints.length) {
    return state.calibrationMode
      ? '<text class="overlay-note" x="4" y="8">Click top and bottom of a known object.</text>'
      : "";
  }

  const points = state.calibrationPoints;
  const pointMarkup = points
    .map(
      (point, index) => `
        <circle class="overlay-point" cx="${point.x}" cy="${point.y}" r="1.2"></circle>
        <text class="overlay-note" x="${point.x + 1.6}" y="${point.y - 1.2}">${index === 0 ? "top" : "bottom"}</text>
      `,
    )
    .join("");

  if (points.length === 1) {
    return `${pointMarkup}<text class="overlay-note" x="4" y="8">Click the bottom point.</text>`;
  }

  return `
    <line class="overlay-line" x1="${points[0].x}" y1="${points[0].y}" x2="${points[1].x}" y2="${points[1].y}"></line>
    ${pointMarkup}
  `;
}

function beginCalibration() {
  state.calibrationMode = true;
  state.calibrationPoints = [];
  render();
}

function handleOverlayClick(event) {
  if (!state.calibrationMode) {
    return;
  }

  const svgPoint = getSvgPercentPoint(event);
  state.calibrationPoints = [...state.calibrationPoints, svgPoint].slice(0, 2);

  if (state.calibrationPoints.length === 2) {
    commitCalibration();
  }

  render();
}

function commitCalibration() {
  const realHeightMeters = Number(els.referenceHeight.value);
  const label = els.referenceLabel.value.trim() || "Reference object";
  if (!Number.isFinite(realHeightMeters) || realHeightMeters <= 0) {
    state.calibrationMode = false;
    state.calibrationPoints = [];
    return;
  }

  const [topPoint, bottomPoint] = state.calibrationPoints;
  const pixelHeight = Math.abs(bottomPoint.y - topPoint.y) * 0.01 * getDisplayedImageHeight();
  if (!pixelHeight) {
    state.calibrationMode = false;
    state.calibrationPoints = [];
    return;
  }

  state.scaleCalibration = {
    label,
    realHeightMeters,
    pixelHeight,
    pixelsPerMeter: pixelHeight / realHeightMeters,
  };
  state.calibrationMode = false;
  if (state.analysis) {
    state.roomModel = buildRoomModel(state.analysis, state.scaleCalibration);
  }
}

function getSvgPercentPoint(event) {
  const rect = els.overlay.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
}

function getDisplayedImageHeight() {
  return els.image.getBoundingClientRect().height || 1;
}

function formatScaleSummary() {
  if (!state.scaleCalibration) {
    return "Uncalibrated. Using default room proportions.";
  }
  const pixelsPerMeter = Math.round(state.scaleCalibration.pixelsPerMeter);
  return `${state.scaleCalibration.label}: ${state.scaleCalibration.realHeightMeters.toFixed(2)}m (${pixelsPerMeter} px/m).`;
}

async function createPreviewUrl(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    await loadImage(objectUrl);
    return objectUrl;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    return readFileAsDataUrl(file);
  }
}

async function inspectSourceFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = extractAsciiWindow(bytes, 256000);
  const extension = getFileExtension(file.name);
  const isHeicLike =
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    extension === "heic" ||
    extension === "heif";
  const signals = detectHeicSignals(ascii);

  return {
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "unknown",
    extension,
    isHeicLike,
    kindLabel: isHeicLike ? "HEIC/HEIF" : file.type || extension || "image",
    depthStatus: summarizeDepthSignals(isHeicLike, signals),
    signals,
  };
}

function extractAsciiWindow(bytes, maxBytes) {
  const length = Math.min(bytes.length, maxBytes);
  let text = "";
  for (let index = 0; index < length; index += 1) {
    const value = bytes[index];
    text += value >= 32 && value <= 126 ? String.fromCharCode(value) : " ";
  }
  return text;
}

function detectHeicSignals(ascii) {
  const signatures = [
    { pattern: "ftypheic", label: "heic-container" },
    { pattern: "ftypheix", label: "heic-container" },
    { pattern: "public.heic", label: "public.heic" },
    { pattern: "depth", label: "depth" },
    { pattern: "disparity", label: "disparity" },
    { pattern: "portrait", label: "portrait" },
    { pattern: "hdep", label: "depth-float16" },
    { pattern: "fdep", label: "depth-float32" },
    { pattern: "hdis", label: "disparity-float16" },
    { pattern: "fdis", label: "disparity-float32" },
    { pattern: "aux", label: "auxiliary-data" },
  ];

  return signatures
    .filter((signature) => ascii.toLowerCase().includes(signature.pattern.toLowerCase()))
    .map((signature) => signature.label)
    .filter((label, index, array) => array.indexOf(label) === index);
}

function summarizeDepthSignals(isHeicLike, signals) {
  if (!isHeicLike) {
    return "Non-HEIC image. Chidar will use RGB-only reconstruction.";
  }
  if (signals.some((signal) => signal.includes("depth")) || signals.includes("disparity")) {
    return "Possible depth/disparity payload detected. Browser path preserves the original file for future extraction.";
  }
  if (signals.includes("portrait") || signals.includes("auxiliary-data")) {
    return "Possible auxiliary image payload detected, but browser-side depth extraction is not confirmed yet.";
  }
  return "HEIC preserved, but no clear depth/disparity signature was found in the browser scan.";
}

function getFileExtension(name) {
  const parts = String(name).toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) : "";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function renderModelCanvas() {
  const canvas = els.modelCanvas;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  drawModelBackground(context, width, height);

  if (!state.roomModel) {
    drawCanvasMessage(
      context,
      width,
      height,
      state.analysis
        ? "Add a scale calibration to improve room dimensions."
        : "Analyze a room image to generate a 3D box model.",
    );
    return;
  }

  drawRoomModel(context, width, height, state.roomModel, state.view);
}

function drawModelBackground(context, width, height) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(255,252,247,0.9)");
  gradient.addColorStop(1, "rgba(224,210,187,0.85)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawCanvasMessage(context, width, height, message) {
  context.fillStyle = "rgba(58, 47, 38, 0.78)";
  context.font = "600 32px 'Space Grotesk', sans-serif";
  context.textAlign = "center";
  context.fillText("3D Preview", width / 2, height / 2 - 16);
  context.font = "500 22px 'Space Grotesk', sans-serif";
  context.fillStyle = "rgba(88, 74, 60, 0.72)";
  wrapCanvasText(context, message, width / 2, height / 2 + 28, width * 0.68, 30);
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  let offset = 0;

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line, x, y + offset);
      line = word;
      offset += lineHeight;
    } else {
      line = test;
    }
  });

  if (line) {
    context.fillText(line, x, y + offset);
  }
}

function drawRoomModel(context, width, height, model, view) {
  const camera = {
    x: width * 0.5,
    y: height * 0.72,
    scale:
      (Math.min(width, height) * 0.12 * (view.zoom / 100)) /
      Math.max(model.width, model.depth, model.height),
    pitch: Number(view.pitch) / 100,
    yaw: (Number(view.yaw) * Math.PI) / 180,
  };

  const floor = [
    projectPoint(0, 0, 0, camera),
    projectPoint(model.width, 0, 0, camera),
    projectPoint(model.width, 0, model.depth, camera),
    projectPoint(0, 0, model.depth, camera),
  ];
  const ceiling = [
    projectPoint(0, model.height, 0, camera),
    projectPoint(model.width, model.height, 0, camera),
    projectPoint(model.width, model.height, model.depth, camera),
    projectPoint(0, model.height, model.depth, camera),
  ];

  context.fillStyle = "rgba(188, 144, 101, 0.22)";
  drawPolygon(context, floor, true);
  context.fillStyle = "rgba(137, 155, 118, 0.12)";
  drawPolygon(context, [ceiling[0], ceiling[1], floor[1], floor[0]], true);
  drawPolygon(context, [ceiling[1], ceiling[2], floor[2], floor[1]], true);

  context.strokeStyle = "rgba(73, 58, 44, 0.9)";
  context.lineWidth = 2;
  [floor, ceiling].forEach((face) => drawPolygon(context, face, false));
  for (let index = 0; index < floor.length; index += 1) {
    drawLine(context, floor[index], ceiling[index]);
  }

  model.objects.forEach((object, index) => {
    drawObjectBox(context, object, camera, index);
  });

  context.fillStyle = "rgba(33, 29, 24, 0.82)";
  context.font = "600 28px 'Space Grotesk', sans-serif";
  context.textAlign = "left";
  context.fillText(
    `${model.width.toFixed(1)}m x ${model.depth.toFixed(1)}m x ${model.height.toFixed(1)}m`,
    32,
    44,
  );
}

function drawObjectBox(context, object, camera, index) {
  const x1 = object.x;
  const x2 = object.x + object.width;
  const z1 = object.z;
  const z2 = object.z + object.depth;
  const y = object.height;
  const bottom = [
    projectPoint(x1, 0, z1, camera),
    projectPoint(x2, 0, z1, camera),
    projectPoint(x2, 0, z2, camera),
    projectPoint(x1, 0, z2, camera),
  ];
  const top = [
    projectPoint(x1, y, z1, camera),
    projectPoint(x2, y, z1, camera),
    projectPoint(x2, y, z2, camera),
    projectPoint(x1, y, z2, camera),
  ];
  const palette = ["rgba(57, 93, 122, 0.22)", "rgba(157, 97, 72, 0.22)", "rgba(97, 119, 80, 0.22)"];

  context.fillStyle = palette[index % palette.length];
  drawPolygon(context, [top[0], top[1], bottom[1], bottom[0]], true);
  drawPolygon(context, [top[1], top[2], bottom[2], bottom[1]], true);
  drawPolygon(context, top, true);
  context.strokeStyle = "rgba(43, 51, 60, 0.9)";
  context.lineWidth = 1.6;
  [bottom, top].forEach((face) => drawPolygon(context, face, false));
  for (let edge = 0; edge < bottom.length; edge += 1) {
    drawLine(context, bottom[edge], top[edge]);
  }
}

function drawPolygon(context, points, fill) {
  if (!points.length) {
    return;
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  if (fill) {
    context.fill();
  } else {
    context.stroke();
  }
}

function drawLine(context, start, end) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function projectPoint(x, y, z, camera) {
  const centerX = x;
  const centerZ = z;
  const rotatedX = centerX * Math.cos(camera.yaw) - centerZ * Math.sin(camera.yaw);
  const rotatedZ = centerX * Math.sin(camera.yaw) + centerZ * Math.cos(camera.yaw);
  const isoX = rotatedX - rotatedZ;
  const isoY = (rotatedX + rotatedZ) * camera.pitch - y * 1.28;
  return {
    x: camera.x + isoX * 0.86 * camera.scale,
    y: camera.y - isoY * camera.scale,
  };
}

function buildRoomModel(analysis, calibration) {
  const roomWidth = estimateRoomWidthMeters(analysis, calibration);
  const roomDepth = estimateRoomDepthMeters(analysis, calibration);
  const roomHeight = estimateRoomHeightMeters(calibration);
  const objects = (analysis.avoidZones || []).map((zone, index) => {
    const width = Math.max(0.6, roomWidth * (zone.width / 100) * 0.9);
    const depth = Math.max(0.45, roomDepth * (zone.height / 100) * 0.4);
    return {
      name: zone.name || `object ${index + 1}`,
      x: clamp(roomWidth * (zone.x / 100), 0.1, Math.max(0.1, roomWidth - width - 0.1)),
      z: clamp(roomDepth * ((zone.y - 20) / 80), 0.1, Math.max(0.1, roomDepth - depth - 0.1)),
      width,
      depth,
      height: Math.min(roomHeight * 0.6, Math.max(0.7, roomHeight * 0.28)),
    };
  });

  return {
    width: roomWidth,
    depth: roomDepth,
    height: roomHeight,
    objects,
    walls: [
      { name: "left wall", width: roomDepth, height: roomHeight },
      { name: "back wall", width: roomWidth, height: roomHeight },
      { name: "right wall", width: roomDepth, height: roomHeight },
    ],
  };
}

function handleViewChange() {
  state.view.yaw = Number(els.yawControl.value);
  state.view.pitch = Number(els.pitchControl.value);
  state.view.zoom = Number(els.zoomControl.value);
  renderModelCanvas();
}

function renderSceneOutput() {
  if (!state.roomModel || !state.analysis) {
    els.sceneOutput.textContent = "No scene model yet.";
    return;
  }

  const payload = buildScenePayload();
  els.sceneOutput.textContent = JSON.stringify(payload, null, 2);
}

function buildScenePayload() {
  return {
    units: "meters",
    source: "single-image reconstruction",
    sourceFile: state.sourceFileInfo
      ? {
          name: state.sourceFileInfo.name,
          format: state.sourceFileInfo.kindLabel,
          mimeType: state.sourceFileInfo.mimeType,
          sizeBytes: state.sourceFileInfo.sizeBytes,
          depthStatus: state.sourceFileInfo.depthStatus,
          signals: state.sourceFileInfo.signals,
        }
      : null,
    calibration: state.scaleCalibration
      ? {
          label: state.scaleCalibration.label,
          realHeightMeters: state.scaleCalibration.realHeightMeters,
          pixelsPerMeter: Number(state.scaleCalibration.pixelsPerMeter.toFixed(2)),
        }
      : null,
    analysis: {
      summary: state.analysis.summary,
      roomType: state.analysis.roomType,
      cameraView: state.analysis.cameraView,
      lighting: state.analysis.lighting,
    },
    room: {
      width: Number(state.roomModel.width.toFixed(3)),
      depth: Number(state.roomModel.depth.toFixed(3)),
      height: Number(state.roomModel.height.toFixed(3)),
    },
    floorPolygon: (state.analysis.floorPolygon || []).map((point) => ({
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
    })),
    walls: state.roomModel.walls,
    objects: state.roomModel.objects.map((object) => ({
      name: object.name,
      x: Number(object.x.toFixed(3)),
      z: Number(object.z.toFixed(3)),
      width: Number(object.width.toFixed(3)),
      depth: Number(object.depth.toFixed(3)),
      height: Number(object.height.toFixed(3)),
    })),
  };
}

function exportSceneJson() {
  if (!state.roomModel) {
    return;
  }
  downloadFile("chidar-room-model.json", JSON.stringify(buildScenePayload(), null, 2), "application/json");
}

function exportSceneObj() {
  if (!state.roomModel) {
    return;
  }
  downloadFile("chidar-room-model.obj", buildObjText(state.roomModel), "text/plain");
}

function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildObjText(model) {
  const vertices = [];
  const faces = [];

  addBox(vertices, faces, 0, 0, 0, model.width, 0.02, model.depth);
  addBox(vertices, faces, 0, 0, 0, 0.02, model.height, model.depth);
  addBox(vertices, faces, model.width - 0.02, 0, 0, 0.02, model.height, model.depth);
  addBox(vertices, faces, 0, 0, model.depth - 0.02, model.width, model.height, 0.02);
  model.objects.forEach((object) => {
    addBox(vertices, faces, object.x, 0, object.z, object.width, object.height, object.depth);
  });

  return [
    "# Chidar room model",
    ...vertices.map((vertex) => `v ${vertex.x} ${vertex.y} ${vertex.z}`),
    ...faces.map((face) => `f ${face.join(" ")}`),
    "",
  ].join("\n");
}

function addBox(vertices, faces, x, y, z, width, height, depth) {
  const start = vertices.length + 1;
  vertices.push(
    { x, y, z },
    { x: x + width, y, z },
    { x: x + width, y: y + height, z },
    { x, y: y + height, z },
    { x, y, z: z + depth },
    { x: x + width, y, z: z + depth },
    { x: x + width, y: y + height, z: z + depth },
    { x, y: y + height, z: z + depth },
  );
  faces.push(
    [start, start + 1, start + 2, start + 3],
    [start + 4, start + 5, start + 6, start + 7],
    [start, start + 1, start + 5, start + 4],
    [start + 1, start + 2, start + 6, start + 5],
    [start + 2, start + 3, start + 7, start + 6],
    [start + 3, start, start + 4, start + 7],
  );
}

function estimateRoomWidthMeters(analysis, calibration) {
  const floor = analysis.floorPolygon || [];
  const backLeft = floor[0];
  const backRight = floor[1];
  if (!backLeft || !backRight) {
    return 4.8;
  }
  const widthPercent = Math.abs(backRight.x - backLeft.x);
  if (!calibration) {
    return clamp(widthPercent * 0.07, 3.2, 7.5);
  }
  const pixelWidth = (widthPercent / 100) * (els.image.getBoundingClientRect().width || 1);
  return clamp(pixelWidth / calibration.pixelsPerMeter, 2.8, 10);
}

function estimateRoomDepthMeters(analysis, calibration) {
  const floor = analysis.floorPolygon || [];
  const nearLeft = floor[3];
  const farLeft = floor[0];
  if (!nearLeft || !farLeft) {
    return 5.4;
  }
  const heightPercent = Math.abs(nearLeft.y - farLeft.y);
  if (!calibration) {
    return clamp(heightPercent * 0.09, 3.5, 9);
  }
  const pixelDepth = (heightPercent / 100) * getDisplayedImageHeight();
  return clamp((pixelDepth / calibration.pixelsPerMeter) * 1.8, 3, 12);
}

function estimateRoomHeightMeters(calibration) {
  if (calibration?.label.toLowerCase().includes("door")) {
    return clamp(calibration.realHeightMeters * 1.18, 2.3, 3.6);
  }
  if (calibration) {
    return clamp(calibration.realHeightMeters * 1.45, 2.2, 4);
  }
  return 2.7;
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
