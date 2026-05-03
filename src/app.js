import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Qidar — image -> 2D floor plan -> 3D room STL

const M_TO_FT = 3.28084;

function mToFtIn(m) {
  const totalIn = m * 39.3701;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return inches === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${inches}″`;
}

function sqmToSqft(sqm) {
  return (sqm * 10.7639).toFixed(1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const MAJOR_OBJECTS = {
  // Bedroom
  bed: { w: 1.6, h: 0.55, d: 2.0, color: [194, 116, 92], zone: "back" },
  couch: { w: 2.0, h: 0.85, d: 0.9, color: [98, 128, 196], zone: "back" },
  chair: { w: 0.6, h: 0.85, d: 0.6, color: [212, 146, 78], zone: "center" },
  desk: { w: 1.2, h: 0.75, d: 0.6, color: [155, 120, 85], zone: "center" },
  bookshelf: { w: 0.9, h: 1.8, d: 0.35, color: [140, 100, 68], zone: "left" },
  "tv stand": { w: 1.4, h: 0.5, d: 0.4, color: [80, 82, 88], zone: "front" },
  dresser: { w: 1.2, h: 0.8, d: 0.5, color: [160, 120, 86], zone: "left" },
  nightstand: { w: 0.5, h: 0.55, d: 0.4, color: [170, 130, 96], zone: "back" },
  wardrobe: { w: 1.4, h: 1.9, d: 0.6, color: [140, 105, 78], zone: "left" },
  // Bathroom
  toilet: { w: 0.45, h: 0.4, d: 0.7, color: [198, 206, 214], zone: "right" },
  sink: { w: 0.7, h: 0.35, d: 0.55, color: [144, 160, 170], zone: "left" },
  bathtub: { w: 0.75, h: 0.55, d: 1.7, color: [210, 218, 226], zone: "back" },
  shower: { w: 0.9, h: 2.0, d: 0.9, color: [180, 200, 216], zone: "back" },
  "bathroom cabinet": { w: 0.8, h: 0.7, d: 0.35, color: [165, 145, 125], zone: "left" },
  // Outdoor
  "patio table": { w: 1.2, h: 0.72, d: 1.2, color: [130, 115, 90], zone: "center" },
  "patio chair": { w: 0.6, h: 0.8, d: 0.6, color: [145, 130, 100], zone: "center" },
  "lounge chair": { w: 0.7, h: 0.4, d: 1.8, color: [110, 140, 120], zone: "back" },
  planter: { w: 0.5, h: 0.5, d: 0.5, color: [160, 90, 70], zone: "front" },
  grill: { w: 1.0, h: 0.95, d: 0.6, color: [60, 60, 62], zone: "right" },
  // Kitchen
  "dining table": { w: 1.4, h: 0.75, d: 0.8, color: [150, 104, 70], zone: "center" },
  refrigerator: { w: 0.7, h: 1.7, d: 0.7, color: [170, 182, 198], zone: "left" },
  oven: { w: 0.6, h: 0.9, d: 0.6, color: [120, 122, 130], zone: "left" },
  dishwasher: { w: 0.6, h: 0.85, d: 0.6, color: [160, 168, 178], zone: "left" },
  "kitchen island": { w: 1.6, h: 0.9, d: 0.8, color: [140, 115, 88], zone: "center" },
};

const state = {
  imageDataUrl: "",
  fileName: "",
  generating: false,
  analysis: null,
  roomModel: null,
  layoutModel: null,
  floorPlan: null,
  fengShui: null,
  mesh: null,
  markerMode: null,
  manualOpenings: { door: [], window: [], entrance: [] },
  suppressInferredOpenings: false,
  opts: { wallThick: 0.15, scale: 1 },
  planView: { zoom: 1, panX: 0, panY: 0 },
  view: { rotX: -0.45, rotZ: 0.6, zoom: 1.2 },
  planDrag: null,
  objectDrag: null,
  resizeDrag: null,
  selectedObjectIndex: -1,
  suppressPlanClick: false,
};

const els = {
  upload: document.querySelector("#room-upload"),
  uploadReplace: document.querySelector("#room-upload-replace"),
  generateBtn: document.querySelector("#analyze-button"),
  resetBtn: document.querySelector("#reset-button"),
  dropHint: document.querySelector("#drop-hint"),
  viewer: document.querySelector("#viewer"),
  image: document.querySelector("#room-image"),
  statusBadge: document.querySelector("#status-badge"),
  fileBadge: document.querySelector("#file-badge"),
  modelBadge: document.querySelector("#model-badge"),
  planCanvas: document.querySelector("#plan-canvas"),
  modelCanvas: document.querySelector("#model-canvas"),
  compass3d: document.querySelector(".compass-3d"),
  exportStl: document.querySelector("#export-stl"),
  exportObj: document.querySelector("#export-obj"),
  optScale: document.querySelector("#opt-scale"),
  markDoor: document.querySelector("#mark-door"),
  markWindow: document.querySelector("#mark-window"),
  markEntrance: document.querySelector("#mark-entrance"),
  clearOpenings: document.querySelector("#clear-openings"),
  markerStatus: document.querySelector("#marker-status"),
  furnitureStatus: document.querySelector("#furniture-status"),
  rotateSelected: document.querySelector("#rotate-selected"),
  removeSelected: document.querySelector("#remove-selected"),
  furnitureButtons: [...document.querySelectorAll("[data-add-furniture]")],
  infoPanel: document.querySelector("#info-panel"),
  fengshuiPanel: document.querySelector("#fengshui-panel"),
  pipeline: document.querySelector("#pipeline"),
};

document.querySelector("#landing-enter").addEventListener("click", () => {
  const landing = document.querySelector("#landing");
  const app = document.querySelector("#app-shell");
  app.hidden = false;
  app.style.opacity = "0";
  landing.classList.add("landing-exit");
  landing.addEventListener("animationend", () => {
    landing.hidden = true;
    app.style.opacity = "1";
  }, { once: true });
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "" : "dark");
  document.querySelector("#theme-toggle").textContent = dark ? "🌙" : "☀️";
  if (threePreview?.renderer) {
    const bg = dark ? 0xf8fafe : 0x1a1d26;
    threePreview.renderer.setClearColor(bg, 1);
    threePreview.scene.background = new THREE.Color(bg);
    threePreview.scene.fog = new THREE.Fog(bg, 8, 28);
  }
  renderFloorPlan();
});
els.upload.addEventListener("change", handleUpload);
els.uploadReplace.addEventListener("change", handleUpload);
els.generateBtn.addEventListener("click", generate);
els.resetBtn.addEventListener("click", reset);
els.exportStl.addEventListener("click", exportSTL);
els.exportObj.addEventListener("click", exportOBJ);
els.markDoor.addEventListener("click", () => setMarkerMode("door"));
els.markWindow.addEventListener("click", () => setMarkerMode("window"));
els.markEntrance.addEventListener("click", () => setMarkerMode("entrance"));
els.clearOpenings.addEventListener("click", clearManualOpenings);
if (els.rotateSelected) els.rotateSelected.addEventListener("click", rotateSelectedFurniture);
if (els.removeSelected) els.removeSelected.addEventListener("click", removeSelectedFurniture);
els.furnitureButtons.forEach((button) => {
  button.addEventListener("click", () => addFurnitureFromToolbox(button.dataset.addFurniture));
});
els.optScale.addEventListener("change", () => {
  state.opts.scale = Math.max(0.01, +els.optScale.value || 1);
  if (state.floorPlan && state.analysis) {
    rebuildMeshFromCurrentPlan();
    render();
  }
});

els.planCanvas.addEventListener("mousedown", handlePlanPointerDown);
window.addEventListener("mousemove", handlePlanPointerMove);
window.addEventListener("mouseup", handlePlanPointerUp);
els.planCanvas.addEventListener("wheel", handlePlanWheel, { passive: false });
els.planCanvas.addEventListener("click", handlePlanCanvasClick);

const threePreview = initThreePreview();
window.addEventListener("resize", handleThreePreviewResize);
handleThreePreviewResize();

initTabs();
render();

function initTabs() {
  document.querySelectorAll(".tab-bar").forEach((bar) => {
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      bar.querySelectorAll(".tab-btn").forEach((node) => node.classList.remove("is-active"));
      btn.classList.add("is-active");
      bar.nextElementSibling.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tab === btn.dataset.tab);
      });
    });
  });
  document.querySelectorAll(".toolbox-tabs").forEach((nav) => {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".toolbox-tab");
      if (!btn) return;
      nav.querySelectorAll(".toolbox-tab").forEach((n) => n.classList.remove("is-active"));
      btn.classList.add("is-active");
      nav.nextElementSibling.querySelectorAll(".furniture-actions").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.ftab === btn.dataset.ftab);
      });
    });
  });
}

function setPipeStep(active, done) {
  els.pipeline.hidden = false;
  els.pipeline.querySelectorAll(".pipe-step").forEach((el) => {
    const step = el.dataset.step;
    el.classList.toggle("is-active", step === active);
    el.classList.toggle("is-done", done.includes(step));
  });
}

async function handleUpload(event) {
  const [file] = event.target.files ?? [];
  if (!file) return;
  state.fileName = file.name;
  state.imageDataUrl = await createPreviewUrl(file);
  state.analysis = null;
  state.roomModel = null;
  state.layoutModel = null;
  state.floorPlan = null;
  state.fengShui = null;
  state.mesh = null;
  state.markerMode = null;
  state.manualOpenings = { door: [], window: [], entrance: [] };
  state.suppressInferredOpenings = false;
  state.planView = { zoom: 1, panX: 0, panY: 0 };
  state.planDrag = null;
  state.objectDrag = null;
  state.resizeDrag = null;
  state.selectedObjectIndex = -1;
  state.suppressPlanClick = false;
  els.image.src = state.imageDataUrl;
  render();
}

function reset() {
  state.imageDataUrl = "";
  state.fileName = "";
  state.generating = false;
  state.analysis = null;
  state.roomModel = null;
  state.layoutModel = null;
  state.floorPlan = null;
  state.fengShui = null;
  state.mesh = null;
  state.markerMode = null;
  state.manualOpenings = { door: [], window: [], entrance: [] };
  state.suppressInferredOpenings = false;
  state.planView = { zoom: 1, panX: 0, panY: 0 };
  state.planDrag = null;
  state.objectDrag = null;
  state.resizeDrag = null;
  state.selectedObjectIndex = -1;
  state.suppressPlanClick = false;
  els.upload.value = "";
  els.image.removeAttribute("src");
  els.pipeline.hidden = true;
  render();
}

async function generate() {
  if (!state.imageDataUrl || state.generating) return;
  state.generating = true;
  render();
  await tick();

  try {
    setPipeStep("convert", []);
    const payload = await extractImagePayload();

    setPipeStep("analyze", ["convert"]);
    const roomResp = await fetch("/api/model-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!roomResp.ok) throw new Error(`Server error ${roomResp.status}`);
    const roomData = await roomResp.json();
    state.analysis = roomData.analysis;
    state.roomModel = roomData.roomModel;

    setPipeStep("mesh", ["convert", "analyze"]);
    let detections = [];
    try {
      detections = await detectObjects();
    } catch (error) {
      console.warn("[Qidar] Object detection failed:", error.message);
    }

    const colors = sampleRegionColors(state.analysis);
    state.layoutModel = buildLayoutModel(state.roomModel, state.analysis, state.manualOpenings);
    state.floorPlan = buildFloorPlan2D(state.roomModel, state.analysis, state.layoutModel, detections, colors);
    state.fengShui = buildFengShuiModel(state.floorPlan, state.layoutModel, state.analysis);

    setPipeStep("clean", ["convert", "analyze", "mesh"]);
    rebuildMeshFromCurrentPlan();

    setPipeStep("done", ["convert", "analyze", "mesh", "clean", "done"]);
  } catch (error) {
    console.error("Generation failed:", error);
    state.analysis = state.analysis || { summary: `Failed: ${error.message}` };
    state.roomModel = null;
    state.layoutModel = null;
    state.floorPlan = null;
    state.fengShui = null;
    state.mesh = null;
  } finally {
    state.generating = false;
    render();
  }
}

async function detectObjects() {
  if (!window.tf) {
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js");
  }
  if (!window.cocoSsd) {
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
  }
  const model = await window.cocoSsd.load();
  return model.detect(els.image, 20, 0.3);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

function render() {
  const hasImage = Boolean(state.imageDataUrl);
  const hasMesh = Boolean(state.mesh);
  const hasPlan = Boolean(state.floorPlan);
  els.generateBtn.disabled = !hasImage || state.generating;
  els.generateBtn.textContent = state.generating ? "Generating…" : "Analyze Layout";
  els.exportStl.disabled = !hasMesh;
  els.exportObj.disabled = !hasMesh;
  els.furnitureButtons.forEach((button) => {
    button.disabled = !hasPlan;
  });
  if (els.rotateSelected) {
    els.rotateSelected.disabled = !(state.selectedObjectIndex >= 0 && state.floorPlan?.objects[state.selectedObjectIndex]);
  }
  els.dropHint.hidden = hasImage;
  els.viewer.hidden = !hasImage;
  els.statusBadge.textContent = state.generating ? "Analyzing" : hasMesh ? "Ready" : hasPlan ? "Plan ready" : hasImage ? "Image loaded" : "Idle";
  els.fileBadge.textContent = state.fileName || "No file";
  const room = state.roomModel;
  els.modelBadge.textContent = room ? `${mToFtIn(room.width)} × ${mToFtIn(room.depth)} × ${mToFtIn(room.height)}` : "—";
  if (els.removeSelected) {
    els.removeSelected.disabled = !(state.selectedObjectIndex >= 0 && state.floorPlan?.objects[state.selectedObjectIndex]);
  }
  renderMarkerStatus();
  renderFurnitureStatus();
  renderInfo();
  renderFloorPlan();
  renderPreview();
}

function setMarkerMode(mode) {
  state.markerMode = state.markerMode === mode ? null : mode;
  state.planDrag = null;
  state.objectDrag = null;
  state.resizeDrag = null;
  state.suppressPlanClick = false;
  renderMarkerStatus();
}

function clearManualOpenings() {
  state.manualOpenings = { door: [], window: [], entrance: [] };
  state.markerMode = null;
  state.suppressInferredOpenings = true;
  rebuildDerivedModels();
}

function renderFurnitureStatus() {
  if (!els.furnitureStatus) return;
  if (!state.floorPlan) {
    els.furnitureStatus.textContent = "Analyze the room, then add furniture and drag it in the 2D plan.";
    return;
  }
  const selected = state.selectedObjectIndex >= 0 ? state.floorPlan.objects[state.selectedObjectIndex] : null;
  if (selected) {
    els.furnitureStatus.textContent = `${selected.label} selected. Drag it in the 2D plan, rotate it, or remove it from the toolbox.`;
    return;
  }
  els.furnitureStatus.textContent = `Add furniture from the toolbox or drag existing pieces. ${state.floorPlan.objects.length} objects in plan.`;
}

function addFurnitureFromToolbox(label) {
  if (!state.floorPlan || !state.layoutModel) return;
  const object = buildToolboxFurniture(label, state.floorPlan, state.layoutModel);
  if (!object) return;
  state.floorPlan.objects.push(object);
  state.floorPlan.objects = resolveObjectCollisions(state.floorPlan.objects, state.layoutModel, state.floorPlan.wallThickness);
  state.selectedObjectIndex = state.floorPlan.objects.findIndex((item) => item === object);
  if (state.selectedObjectIndex < 0) {
    state.selectedObjectIndex = Math.max(0, state.floorPlan.objects.length - 1);
  }
  rebuildDerivedModels();
}

function buildToolboxFurniture(label, plan, layout) {
  const preset = MAJOR_OBJECTS[label];
  if (!preset) return null;
  const countOfType = plan.objects.filter((object) => normalizeLabel(object.label) === label).length;
  const zone = preset.zone || "center";
  const sideOptions = zone === "center" ? ["center", "left", "right"] : ["center", "left", "right"];
  const sideZone = sideOptions[countOfType % sideOptions.length];
  const width = clamp(preset.w, 0.25, Math.max(0.25, plan.width - plan.wallThickness * 2));
  const depth = clamp(preset.d, 0.25, Math.max(0.25, plan.depth - plan.wallThickness * 2));
  const height = Math.max(preset.h, 0.25);
  const depthBand = layout.zoneBands.find((band) => band.name === zone) || layout.zoneBands[1];
  const sideBand = layout.sideBands.find((band) => band.name === sideZone) || layout.sideBands[1];
  const x = clamp((sideBand.x0 + sideBand.x1 - width) / 2, plan.wallThickness, plan.width - plan.wallThickness - width);
  const z = clamp((depthBand.z0 + depthBand.z1 - depth) / 2, plan.wallThickness, plan.depth - plan.wallThickness - depth);
  return {
    label,
    source: "toolbox",
    color: preset.color,
    x,
    z,
    width,
    depth,
    height,
    zone,
    sideZone,
    rotation: 0,
  };
}

function removeSelectedFurniture() {
  if (!state.floorPlan || state.selectedObjectIndex < 0) return;
  state.floorPlan.objects.splice(state.selectedObjectIndex, 1);
  state.selectedObjectIndex = -1;
  rebuildDerivedModels();
}

function rotateSelectedFurniture() {
  if (!state.floorPlan || state.selectedObjectIndex < 0) return;
  const object = state.floorPlan.objects[state.selectedObjectIndex];
  if (!object) return;
  object.rotation = ((((object.rotation || 0) + Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  rebuildDerivedModels();
}

function handlePlanPointerDown(event) {
  if (!state.floorPlan) return;
  if (event.button !== 0) return;
  if (state.markerMode) {
    state.suppressPlanClick = true;
    placeMarkerAtEvent(event);
    return;
  }
  const point = getPlanPointFromEvent(event);
  const hit = point ? findObjectAtPlanPoint(point, state.floorPlan) : -1;
  // Check resize handles on selected object first
  if (point && state.selectedObjectIndex >= 0) {
    const handle = hitResizeHandle(point, state.floorPlan.objects[state.selectedObjectIndex], state.floorPlan);
    if (handle >= 0) {
      const obj = state.floorPlan.objects[state.selectedObjectIndex];
      state.resizeDrag = { handle, startX: obj.x, startZ: obj.z, startW: obj.width, startD: obj.depth };
      return;
    }
  }
  if (hit >= 0) {
    const object = state.floorPlan.objects[hit];
    state.selectedObjectIndex = hit;
    state.objectDrag = {
      index: hit,
      offsetX: point.x - object.x,
      offsetZ: point.z - object.z,
      moved: false,
    };
    renderFloorPlan();
    return;
  }
  state.selectedObjectIndex = -1;
  // Check if clicking on a manual opening to remove it
  if (point) {
    const removed = removeManualOpeningAtPoint(point);
    if (removed) {
      rebuildDerivedModels();
      return;
    }
  }
  state.planDrag = {
    startX: event.clientX,
    startY: event.clientY,
    panX: state.planView.panX,
    panY: state.planView.panY,
    moved: false,
  };
}

function handlePlanPointerMove(event) {
  if (state.resizeDrag && state.floorPlan && state.selectedObjectIndex >= 0) {
    const point = getPlanPointFromEvent(event);
    if (!point) return;
    const obj = state.floorPlan.objects[state.selectedObjectIndex];
    if (!obj) return;
    const rd = state.resizeDrag;
    const wall = state.floorPlan.wallThickness;
    const W = state.floorPlan.width;
    const D = state.floorPlan.depth;
    // Anchor is the opposite corner (in room-space AABB)
    const ax = (rd.handle === 1 || rd.handle === 2) ? rd.startX : rd.startX + rd.startW;
    const az = (rd.handle === 2 || rd.handle === 3) ? rd.startZ : rd.startZ + rd.startD;
    // New box from anchor to mouse
    const minX = Math.min(point.x, ax);
    const maxX = Math.max(point.x, ax);
    const minZ = Math.min(point.z, az);
    const maxZ = Math.max(point.z, az);
    const newW = clamp(maxX - minX, 0.2, W - wall * 2);
    const newD = clamp(maxZ - minZ, 0.2, D - wall * 2);
    obj.width = newW;
    obj.depth = newD;
    obj.x = clamp(minX, wall, W - wall - newW);
    obj.z = clamp(minZ, wall, D - wall - newD);
    rebuildMeshFromCurrentPlan();
    renderFloorPlan();
    renderPreview();
    return;
  }
  if (state.objectDrag && state.floorPlan) {
    const point = getPlanPointFromEvent(event);
    if (!point) return;
    const object = state.floorPlan.objects[state.objectDrag.index];
    if (!object) return;
    object.x = clamp(point.x - state.objectDrag.offsetX, state.floorPlan.wallThickness, state.floorPlan.width - state.floorPlan.wallThickness - object.width);
    object.z = clamp(point.z - state.objectDrag.offsetZ, state.floorPlan.wallThickness, state.floorPlan.depth - state.floorPlan.wallThickness - object.depth);
    object.zone = deriveDepthZone(object, state.floorPlan);
    object.sideZone = deriveSideZone(object, state.floorPlan);
    state.objectDrag.moved = true;
    rebuildMeshFromCurrentPlan();
    renderFloorPlan();
    renderPreview();
    return;
  }
  if (!state.planDrag) return;
  const dx = event.clientX - state.planDrag.startX;
  const dy = event.clientY - state.planDrag.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.planDrag.moved = true;
  state.planView.panX = state.planDrag.panX + dx;
  state.planView.panY = state.planDrag.panY + dy;
  renderFloorPlan();
}

function handlePlanPointerUp() {
  if (state.resizeDrag) {
    state.resizeDrag = null;
    state.suppressPlanClick = true;
    rebuildDerivedModels();
    return;
  }
  if (state.objectDrag) {
    state.suppressPlanClick = Boolean(state.objectDrag.moved);
    state.objectDrag = null;
    rebuildDerivedModels();
    return;
  }
  state.suppressPlanClick = Boolean(state.planDrag?.moved);
  state.planDrag = null;
}

function handlePlanWheel(event) {
  if (!state.floorPlan) return;
  event.preventDefault();
  const rect = els.planCanvas.getBoundingClientRect();
  const sx = els.planCanvas.width / rect.width;
  const sy = els.planCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;
  const prevZoom = state.planView.zoom;
  const nextZoom = clamp(prevZoom * (1 - event.deltaY * 0.0012), 0.6, 4);
  if (nextZoom === prevZoom) return;
  state.planView.panX = px - ((px - state.planView.panX) * (nextZoom / prevZoom));
  state.planView.panY = py - ((py - state.planView.panY) * (nextZoom / prevZoom));
  state.planView.zoom = nextZoom;
  renderFloorPlan();
}

function renderMarkerStatus() {
  if (!els.markerStatus) return;
  if (!state.floorPlan) {
    els.markerStatus.textContent = "Analyze the room, then click the 2D plan to place door, window, and entrance.";
    return;
  }
  const parts = [];
  if (state.manualOpenings.door.length) parts.push(`${state.manualOpenings.door.length} door(s)`);
  if (state.manualOpenings.window.length) parts.push(`${state.manualOpenings.window.length} window(s)`);
  if (state.manualOpenings.entrance.length) parts.push(`${state.manualOpenings.entrance.length} entrance(s)`);
  if (state.selectedObjectIndex >= 0 && state.floorPlan?.objects[state.selectedObjectIndex]) {
    parts.push(`${state.floorPlan.objects[state.selectedObjectIndex].label} selected`);
  }
  const status = parts.length ? parts.join(" · ") : "using inferred openings";
  const modeText = state.markerMode ? `Click the plan to place ${state.markerMode}.` : "Drag furniture to maneuver it, or choose a marker mode to edit openings.";
  els.markerStatus.textContent = `${status} — ${modeText}`;
}

function renderInfo() {
  const room = state.roomModel;
  const analysis = state.analysis;
  const layout = state.layoutModel;
  const plan = state.floorPlan;
  const fengShui = state.fengShui;
  if (!analysis) {
    els.infoPanel.textContent = "Upload a room photo and analyze the layout.";
    return;
  }
  if (!room) {
    els.infoPanel.innerHTML = `<div class="metric"><strong>Status</strong>${esc(analysis.summary)}</div>`;
    return;
  }

  const objectSummary = plan?.objects?.length
    ? plan.objects.map((obj) => esc(obj.label)).join(" · ")
    : "No furniture footprints placed";
  const openingSummary = layout?.openings?.length
    ? layout.openings.map((opening) => `${opening.type} on ${opening.wall}`).join(" · ")
    : "No inferred openings";
  const fengShuiSummary = fengShui
    ? `${fengShui.score}/100 · ${esc(fengShui.verdict)}`
    : "Not analyzed yet";

  els.infoPanel.innerHTML = `
    <div class="metric"><strong>Summary</strong>${esc(analysis.summary)}</div>
    <div class="metric"><strong>Room type</strong>${esc(analysis.roomType)}</div>
    <div class="metric"><strong>Dimensions</strong>${mToFtIn(room.width)} wide × ${mToFtIn(room.depth)} deep × ${mToFtIn(room.height)} high</div>
    <div class="metric"><strong>Floor area</strong>${sqmToSqft(room.floorArea)} sq ft</div>
    <div class="metric"><strong>Openings</strong>${openingSummary}</div>
    <div class="metric"><strong>Furniture</strong>${objectSummary}</div>
    <div class="metric"><strong>Feng Shui Score</strong>${fengShuiSummary}</div>
  `;

  // Render feng shui detail panel below the canvases
  if (!fengShui) {
    els.fengshuiPanel.hidden = true;
  } else {
    els.fengshuiPanel.hidden = false;
    const levelIcon = { good: "✅", warn: "⚠️", note: "💡" };
    const elemIcons = { wood: "🪵", fire: "🔥", earth: "🪨", metal: "🪙", water: "💧" };
    const findingsHtml = fengShui.findings.map((f) => `<div class="fs-finding">${levelIcon[f.level] || ""} ${esc(f.text)}</div>`).join("");
    const recsHtml = fengShui.recommendations.length
      ? `<ol class="guidance-list">${fengShui.recommendations.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>`
      : "<em>No issues — looking good.</em>";
    const elemLine = Object.entries(fengShui.elements.counts).map(([e, c]) => `${elemIcons[e] || ""} ${e}: ${c}`).join(" · ");
    els.fengshuiPanel.innerHTML = `
      <div class="fs-header"><h3>Feng Shui · ${fengShui.score}/100</h3><span class="fs-verdict">${esc(fengShui.verdict)}</span></div>
      <div class="fs-col">${findingsHtml}<div style="margin-top:6px;font-size:0.75rem">${elemLine}</div></div>
      <div class="fs-col">${recsHtml}</div>
    `;
  }
}

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sampleRegionColors(analysis) {
  const image = els.image;
  const canvas = document.createElement("canvas");
  const w = Math.min(image.naturalWidth, 300);
  const h = Math.max(1, Math.round(w * image.naturalHeight / image.naturalWidth));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  function avgColor(xPct, yPct, wPct, hPct) {
    const x0 = Math.round((xPct / 100) * w);
    const y0 = Math.round((yPct / 100) * h);
    const x1 = Math.min(w, Math.round(((xPct + wPct) / 100) * w));
    const y1 = Math.min(h, Math.round(((yPct + hPct) / 100) * h));
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4;
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
        n += 1;
      }
    }
    if (!n) return [180, 180, 180];
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  const wallZones = analysis.wallZones || [];
  const horizon = analysis.horizonPercent || 58;
  return {
    leftWall: wallZones[0] ? avgColor(wallZones[0].x, wallZones[0].y, wallZones[0].width, wallZones[0].height) : [190, 185, 175],
    backWall: wallZones[1] ? avgColor(wallZones[1].x, wallZones[1].y, wallZones[1].width, wallZones[1].height) : [200, 195, 185],
    rightWall: wallZones[2] ? avgColor(wallZones[2].x, wallZones[2].y, wallZones[2].width, wallZones[2].height) : [190, 185, 175],
    floor: avgColor(10, horizon, 80, 100 - horizon),
  };
}

function detectRoomPolygon(analysis, roomWidth, roomDepth) {
  return null;
}

function normalizeLabel(label) {
  return String(label || "").trim().toLowerCase();
}

function inferOpenings(roomModel, analysis, anchorWall, manualOpenings) {
  const width = roomModel.width;
  const depth = roomModel.depth;
  if (state.suppressInferredOpenings) {
    const openings = [];
    if (manualOpenings?.door?.length) openings.push(...manualOpenings.door);
    if (manualOpenings?.window?.length) openings.push(...manualOpenings.window);
    if (manualOpenings?.entrance?.length) openings.push(...manualOpenings.entrance);
    return openings;
  }
  const doorWall = anchorWall === "back" ? "front" : anchorWall;
  const inferredOpenings = [];

  if (doorWall === "front") {
    inferredOpenings.push({ type: "door", wall: "front", x: width * 0.36, z: 0, width: width * 0.18, depth: 0 });
  } else if (doorWall === "left") {
    inferredOpenings.push({ type: "door", wall: "left", x: 0, z: depth * 0.16, width: depth * 0.18, depth: 0 });
  } else {
    inferredOpenings.push({ type: "door", wall: "right", x: width, z: depth * 0.16, width: depth * 0.18, depth: 0 });
  }

  inferredOpenings.push({ type: "window", wall: "back", x: width * 0.32, z: depth, width: width * 0.24, depth: 0 });
  if (analysis?.dominantSide === "left") {
    inferredOpenings.push({ type: "window", wall: "right", x: width, z: depth * 0.54, width: depth * 0.16, depth: 0 });
  } else if (analysis?.dominantSide === "right") {
    inferredOpenings.push({ type: "window", wall: "left", x: 0, z: depth * 0.54, width: depth * 0.16, depth: 0 });
  }

  const openings = [];
  if (manualOpenings?.door?.length) openings.push(...manualOpenings.door);
  else openings.push(...inferredOpenings.filter((opening) => opening.type === "door"));

  if (manualOpenings?.window?.length) openings.push(...manualOpenings.window);
  else openings.push(...inferredOpenings.filter((opening) => opening.type === "window"));

  if (manualOpenings?.entrance?.length) openings.push(...manualOpenings.entrance);
  return openings;
}

function buildLayoutModel(roomModel, analysis, manualOpenings) {
  const dominantSide = analysis?.dominantSide || "center";
  const anchorWall = dominantSide === "left" ? "left" : dominantSide === "right" ? "right" : "back";
  const width = roomModel.width;
  const depth = roomModel.depth;
  return {
    width,
    depth,
    height: roomModel.height,
    anchorWall,
    zoneBands: [
      { name: "front", z0: 0.05 * depth, z1: 0.32 * depth },
      { name: "center", z0: 0.32 * depth, z1: 0.68 * depth },
      { name: "back", z0: 0.68 * depth, z1: 0.95 * depth },
    ],
    sideBands: [
      { name: "left", x0: 0.04 * width, x1: 0.34 * width },
      { name: "center", x0: 0.25 * width, x1: 0.75 * width },
      { name: "right", x0: 0.66 * width, x1: 0.96 * width },
    ],
    openings: inferOpenings(roomModel, analysis, anchorWall, manualOpenings),
  };
}

function derivePlanCanvasTransform(plan, canvas) {
  const pad = 48;
  const baseScale = Math.min((canvas.width - pad * 2) / plan.width, (canvas.height - pad * 2) / plan.depth);
  return {
    scale: baseScale * state.planView.zoom,
    ox: ((canvas.width - plan.width * baseScale) / 2) + state.planView.panX,
    oy: ((canvas.height - plan.depth * baseScale) / 2) + state.planView.panY,
  };
}

function getPlanPointFromEvent(event) {
  if (!state.floorPlan) return null;
  const rect = els.planCanvas.getBoundingClientRect();
  const sx = els.planCanvas.width / rect.width;
  const sy = els.planCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;
  const tf = derivePlanCanvasTransform(state.floorPlan, els.planCanvas);
  const x = (px - tf.ox) / tf.scale;
  const z = (py - tf.oy) / tf.scale;
  return {
    x: clamp(x, 0, state.floorPlan.width),
    z: clamp(z, 0, state.floorPlan.depth),
  };
}

function handlePlanCanvasClick(event) {
  if (!state.floorPlan || !state.markerMode) return;
  if (state.suppressPlanClick) {
    state.suppressPlanClick = false;
    return;
  }
  placeMarkerAtEvent(event);
}

function placeMarkerAtEvent(event) {
  if (!state.floorPlan || !state.markerMode) return;
  const mode = state.markerMode;
  const point = getPlanPointFromEvent(event);
  if (!point) return;
  if (mode === "door") {
    state.manualOpenings.door.push(buildManualDoor(point, state.floorPlan));
  } else if (mode === "window") {
    state.manualOpenings.window.push(buildManualWindow(point, state.floorPlan));
  } else if (mode === "entrance") {
    state.manualOpenings.entrance.push(buildManualEntrance(point, state.floorPlan));
  }
  state.markerMode = null;
  state.suppressPlanClick = false;
  rebuildDerivedModels();
}

function buildManualDoor(point, plan) {
  const distances = [
    { wall: "front", value: point.z },
    { wall: "back", value: Math.abs(plan.depth - point.z) },
    { wall: "left", value: point.x },
    { wall: "right", value: Math.abs(plan.width - point.x) },
  ].sort((a, b) => a.value - b.value);
  const wall = distances[0].wall;
  const size = wall === "front" || wall === "back" ? plan.width * 0.18 : plan.depth * 0.18;
  if (wall === "front") return { type: "door", wall, x: clamp(point.x - size / 2, 0, plan.width - size), z: 0, width: size, depth: 0, manual: true };
  if (wall === "back") return { type: "door", wall, x: clamp(point.x - size / 2, 0, plan.width - size), z: plan.depth, width: size, depth: 0, manual: true };
  if (wall === "left") return { type: "door", wall, x: 0, z: clamp(point.z - size / 2, 0, plan.depth - size), width: size, depth: 0, manual: true };
  return { type: "door", wall, x: plan.width, z: clamp(point.z - size / 2, 0, plan.depth - size), width: size, depth: 0, manual: true };
}

function buildManualWindow(point, plan) {
  const distances = [
    { wall: "front", value: point.z },
    { wall: "back", value: Math.abs(plan.depth - point.z) },
    { wall: "left", value: point.x },
    { wall: "right", value: Math.abs(plan.width - point.x) },
  ].sort((a, b) => a.value - b.value);
  const wall = distances[0].wall;
  const size = wall === "front" || wall === "back" ? plan.width * 0.22 : plan.depth * 0.22;
  if (wall === "front") return { type: "window", wall, x: clamp(point.x - size / 2, 0, plan.width - size), z: 0, width: size, depth: 0, manual: true };
  if (wall === "back") return { type: "window", wall, x: clamp(point.x - size / 2, 0, plan.width - size), z: plan.depth, width: size, depth: 0, manual: true };
  if (wall === "left") return { type: "window", wall, x: 0, z: clamp(point.z - size / 2, 0, plan.depth - size), width: size, depth: 0, manual: true };
  return { type: "window", wall, x: plan.width, z: clamp(point.z - size / 2, 0, plan.depth - size), width: size, depth: 0, manual: true };
}

function buildManualEntrance(point, plan) {
  return {
    type: "entrance",
    wall: "inside",
    x: clamp(point.x, 0, plan.width),
    z: clamp(point.z, 0, plan.depth),
    width: 0,
    depth: 0,
    manual: true,
  };
}

function rebuildDerivedModels() {
  if (!state.roomModel || !state.analysis || !state.floorPlan) {
    render();
    return;
  }
  state.layoutModel = buildLayoutModel(state.roomModel, state.analysis, state.manualOpenings);
  state.floorPlan.openings = state.layoutModel.openings || [];
  state.fengShui = buildFengShuiModel(state.floorPlan, state.layoutModel, state.analysis);
  rebuildMeshFromCurrentPlan();
  render();
}

function rebuildMeshFromCurrentPlan() {
  if (!state.floorPlan || !state.analysis) {
    state.mesh = null;
    return;
  }
  const colors = sampleRegionColors(state.analysis);
  state.mesh = cleanMesh(buildMeshFromFloorPlan(state.floorPlan, state.opts, colors));
}

function findObjectAtPlanPoint(point, plan) {
  for (let i = plan.objects.length - 1; i >= 0; i -= 1) {
    const object = plan.objects[i];
    const rot = object.rotation || 0;
    const cx = object.x + object.width / 2;
    const cz = object.z + object.depth / 2;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const dx = point.x - cx;
    const dz = point.z - cz;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (
      lx >= -object.width / 2 &&
      lx <= object.width / 2 &&
      lz >= -object.depth / 2 &&
      lz <= object.depth / 2
    ) {
      return i;
    }
  }
  return -1;
}

function hitResizeHandle(point, obj, plan) {
  if (!obj) return -1;
  const tf = derivePlanCanvasTransform(plan, els.planCanvas);
  const rot = obj.rotation || 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const cx = obj.x + obj.width / 2;
  const cz = obj.z + obj.depth / 2;
  const lx = (point.x - cx) * cos - (point.z - cz) * sin;
  const lz = (point.x - cx) * sin + (point.z - cz) * cos;
  const hw = obj.width / 2;
  const hd = obj.depth / 2;
  const threshold = 8 / tf.scale;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(lx - corners[i][0]) < threshold && Math.abs(lz - corners[i][1]) < threshold) return i;
  }
  return -1;
}

function removeManualOpeningAtPoint(point) {
  const t = 0.3;
  for (const type of ["door", "window", "entrance"]) {
    const arr = state.manualOpenings[type];
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i];
      if (type === "entrance") {
        if (Math.abs(point.x - o.x) < t && Math.abs(point.z - o.z) < t) { arr.splice(i, 1); return true; }
      } else {
        if (o.wall === "front" || o.wall === "back") {
          const z = o.wall === "front" ? 0 : state.floorPlan.depth;
          if (Math.abs(point.z - z) < t && point.x >= o.x - t && point.x <= o.x + o.width + t) { arr.splice(i, 1); return true; }
        } else {
          const x = o.wall === "left" ? 0 : state.floorPlan.width;
          if (Math.abs(point.x - x) < t && point.z >= o.z - t && point.z <= o.z + o.width + t) { arr.splice(i, 1); return true; }
        }
      }
    }
  }
  return false;
}

function deriveDepthZone(object, plan) {
  const centerZ = object.z + object.depth / 2;
  if (centerZ < plan.depth * 0.33) return "front";
  if (centerZ > plan.depth * 0.66) return "back";
  return "center";
}

function deriveSideZone(object, plan) {
  const centerX = object.x + object.width / 2;
  if (centerX < plan.width * 0.34) return "left";
  if (centerX > plan.width * 0.66) return "right";
  return "center";
}

function overlapsRect(a, b, padding = 0) {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.z + a.depth + padding <= b.z ||
    b.z + b.depth + padding <= a.z
  );
}

function getFloorLaneAtDepth(floorPolygon, depthRatio) {
  const floor = floorPolygon?.length >= 4
    ? floorPolygon
    : [{ x: 12, y: 58 }, { x: 88, y: 58 }, { x: 96, y: 100 }, { x: 4, y: 100 }];
  return {
    left: floor[0].x + (floor[3].x - floor[0].x) * depthRatio,
    right: floor[1].x + (floor[2].x - floor[1].x) * depthRatio,
  };
}

function snapObjectToZone(footprint, layout, wallThickness) {
  const zone = footprint.zone || "center";
  const depthBand = layout.zoneBands.find((band) => band.name === zone) || layout.zoneBands[1];
  const sideZone = footprint.sideZone || "center";
  const sideBand = layout.sideBands.find((band) => band.name === sideZone) || layout.sideBands[1];
  let x = clamp(footprint.x, wallThickness, layout.width - wallThickness - footprint.width);
  let z = clamp(footprint.z, wallThickness, layout.depth - wallThickness - footprint.depth);

  if (zone === "back") z = clamp(depthBand.z1 - footprint.depth, wallThickness, layout.depth - wallThickness - footprint.depth);
  if (zone === "front") z = clamp(depthBand.z0, wallThickness, layout.depth - wallThickness - footprint.depth);
  if (zone === "center") z = clamp((depthBand.z0 + depthBand.z1 - footprint.depth) / 2, wallThickness, layout.depth - wallThickness - footprint.depth);

  if (sideZone === "left") x = clamp(sideBand.x0, wallThickness, layout.width - wallThickness - footprint.width);
  if (sideZone === "right") x = clamp(sideBand.x1 - footprint.width, wallThickness, layout.width - wallThickness - footprint.width);
  if (sideZone === "center") x = clamp((sideBand.x0 + sideBand.x1 - footprint.width) / 2, wallThickness, layout.width - wallThickness - footprint.width);

  return { ...footprint, x, z };
}

function resolveObjectCollisions(objects, layout, wallThickness) {
  const resolved = [];
  for (const object of objects) {
    let candidate = { ...object };
    if (!resolved.some((existing) => overlapsRect(existing, candidate, 0.04))) {
      resolved.push(candidate);
      continue;
    }
    let placed = false;
    const step = 0.25;
    for (let dz = 0; dz <= layout.depth && !placed; dz += step) {
      for (let dx = 0; dx <= layout.width && !placed; dx += step) {
        for (const [sx, sz] of [[1,1],[-1,1],[1,-1],[-1,-1]]) {
          const tx = clamp(object.x + dx * sx, wallThickness, layout.width - wallThickness - candidate.width);
          const tz = clamp(object.z + dz * sz, wallThickness, layout.depth - wallThickness - candidate.depth);
          const test = { ...candidate, x: tx, z: tz };
          if (!resolved.some((existing) => overlapsRect(existing, test, 0.04))) {
            resolved.push(test);
            placed = true;
            break;
          }
        }
      }
    }
    if (!placed) resolved.push(candidate);
  }
  return resolved;
}

function buildFloorPlan2D(roomModel, analysis, layout, detections, colors) {
  const imgW = els.image.naturalWidth || 1;
  const imgH = els.image.naturalHeight || 1;
  const W = roomModel.width;
  const D = roomModel.depth;
  const wall = state.opts.wallThick;
  const floorTop = (analysis.horizonPercent || 58) / 100;
  const floorHeight = Math.max(0.08, 1 - floorTop);
  const floorPolygon = analysis.floorPolygon || [];
  const objects = [];

  function createFootprint({ label, source, rect, color, w, d, h, zone = "center", sideZone = "center" }) {
    const centerXPct = ((rect.x + rect.width / 2) / imgW) * 100;
    const bottomPct = ((rect.y + rect.height) / imgH) * 100;
    const depthRatio = clamp((bottomPct / 100 - floorTop) / floorHeight, 0, 1);
    const lane = getFloorLaneAtDepth(floorPolygon, depthRatio);
    const laneWidthPct = Math.max(4, lane.right - lane.left);
    const lateralRatio = clamp((centerXPct - lane.left) / laneWidthPct, 0, 1);
    const width = clamp(w, 0.2, Math.max(0.2, W - wall * 2));
    const depth = clamp(d, 0.2, Math.max(0.2, D - wall * 2));
    const x = clamp(lateralRatio * W - width / 2, wall, W - wall - width);
    const z = clamp((1 - depthRatio) * (D - depth), wall, D - wall - depth);
    return { label, source, color, x, z, width, depth, height: h, zone, sideZone, rotation: 0 };
  }

  function createFallbackFurniture(label, zone, sideZone = "center", scale = 1) {
    const preset = MAJOR_OBJECTS[label];
    if (!preset) return null;
    const depthBand = layout.zoneBands.find((band) => band.name === zone) || layout.zoneBands[1];
    const sideBand = layout.sideBands.find((band) => band.name === sideZone) || layout.sideBands[1];
    const width = clamp(preset.w * scale, 0.35, Math.max(0.35, W - wall * 2));
    const depth = clamp(preset.d * scale, 0.35, Math.max(0.35, D - wall * 2));
    const height = Math.max(preset.h * scale, 0.3);
    const x = clamp((sideBand.x0 + sideBand.x1 - width) / 2, wall, W - wall - width);
    const z = clamp((depthBand.z0 + depthBand.z1 - depth) / 2, wall, D - wall - depth);
    return {
      label,
      source: "fallback",
      color: preset.color,
      x,
      z,
      width,
      depth,
      height,
      zone,
      sideZone,
      rotation: 0,
    };
  }

  for (const detected of detections || []) {
    const label = normalizeLabel(detected.class);
    const preset = MAJOR_OBJECTS[label];
    if (!detected?.bbox || !preset) continue;
    const [x, y, width, height] = detected.bbox;
    if (width < imgW * 0.07 || height < imgH * 0.07) continue;
    const centerXPct = ((x + width / 2) / imgW) * 100;
    const sideZone = centerXPct < 34 ? "left" : centerXPct > 66 ? "right" : "center";
    objects.push(createFootprint({
      label,
      source: "coco",
      rect: { x, y, width, height },
      color: preset.color,
      w: preset.w * 1.08,
      d: preset.d * 1.08,
      h: preset.h * 1.12,
      zone: preset.zone,
      sideZone,
    }));
  }

  for (const zone of analysis.avoidZones || []) {
    const rect = {
      x: (zone.x / 100) * imgW,
      y: (zone.y / 100) * imgH,
      width: (zone.width / 100) * imgW,
      height: (zone.height / 100) * imgH,
    };
    if (rect.width < imgW * 0.1 || rect.height < imgH * 0.08) continue;
    const widthM = clamp((rect.width / imgW) * W * 0.88, 0.7, W * 0.5);
    const depthM = clamp((rect.height / imgH) * D * 0.42, 0.7, D * 0.45);
    const heightM = clamp(roomModel.height * 0.3, 0.55, 1.3);
    const centerXPct = ((rect.x + rect.width / 2) / imgW) * 100;
    const sideZone = centerXPct < 34 ? "left" : centerXPct > 66 ? "right" : "center";
    const zoneName = ((rect.y + rect.height) / imgH) > 0.72 ? "front" : ((rect.y + rect.height) / imgH) > 0.52 ? "center" : "back";
    objects.push(createFootprint({
      label: sideZone === "center" ? "major furniture" : `major furniture ${sideZone}`,
      source: "grid",
      rect,
      color: [224, 140, 88],
      w: widthM,
      d: depthM,
      h: heightM,
      zone: zoneName,
      sideZone,
    }));
  }

  const snappedObjects = resolveObjectCollisions(
    objects
      .map((object) => snapObjectToZone(object, layout, wall))
      .slice(0, 8),
    layout,
    wall,
  );

  if (snappedObjects.length < 2) {
    const fallbackObjects = [];
    if (analysis.roomType?.includes("bedroom")) {
      fallbackObjects.push(
        createFallbackFurniture("bed", "back", "center", 1),
        createFallbackFurniture("chair", "center", "right", 1),
      );
    } else if (analysis.roomType === "wide living area") {
      fallbackObjects.push(
        createFallbackFurniture("couch", "back", "center", 1),
        createFallbackFurniture("dining table", "center", "center", 1),
        createFallbackFurniture("chair", "center", "left", 1),
      );
    } else {
      fallbackObjects.push(
        createFallbackFurniture("couch", "back", "center", 0.95),
        createFallbackFurniture("dining table", "center", "center", 0.9),
      );
    }
    if (analysis.roomType?.includes("compact")) {
      fallbackObjects.push(createFallbackFurniture("bed", "back", "center", 0.9));
    }
    for (const object of fallbackObjects.filter(Boolean)) {
      if (!snappedObjects.some((existing) => overlapsRect(existing, object, 0.08))) {
        snappedObjects.push(object);
      }
    }
  }

  const boundary = detectRoomPolygon(analysis, W, D) || [
    { x: 0, z: 0 },
    { x: W, z: 0 },
    { x: W, z: D },
    { x: 0, z: D },
  ];

  return {
    width: W,
    depth: D,
    height: roomModel.height,
    wallThickness: wall,
    boundary,
    objects: snappedObjects,
    openings: layout.openings || [],
    colors,
  };
}

function objCenter(o) { return { x: o.x + o.width / 2, z: o.z + o.depth / 2 }; }

function doorPoint(door, plan) {
  if (!door) return null;
  if (door.wall === "front") return { x: door.x + (door.width || 0) / 2, z: 0 };
  if (door.wall === "back") return { x: door.x + (door.width || 0) / 2, z: plan.depth };
  if (door.wall === "left") return { x: 0, z: door.z + (door.width || 0) / 2 };
  return { x: plan.width, z: door.z + (door.width || 0) / 2 };
}

function distToPoint(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function isAgainstWall(obj, plan, wall, threshold) {
  const t = threshold || plan.wallThickness * 2.5;
  if (wall === "back") return obj.z + obj.depth >= plan.depth - t;
  if (wall === "front") return obj.z <= t;
  if (wall === "left") return obj.x <= t;
  if (wall === "right") return obj.x + obj.width >= plan.width - t;
  return false;
}

function isAgainstAnyWall(obj, plan, threshold) {
  return ["front", "back", "left", "right"].some((w) => isAgainstWall(obj, plan, w, threshold));
}

function entryCorridor(plan, dp) {
  if (!dp) return null;
  const cw = plan.width * 0.22;
  const cd = plan.depth * 0.55;
  if (dp.z <= 0.01) return { x: dp.x - cw / 2, z: 0, width: cw, depth: cd };
  if (dp.z >= plan.depth - 0.01) return { x: dp.x - cw / 2, z: plan.depth - cd, width: cw, depth: cd };
  if (dp.x <= 0.01) return { x: 0, z: dp.z - cw / 2, width: cd, depth: cw };
  return { x: plan.width - cd, z: dp.z - cw / 2, width: cd, depth: cw };
}

function baguaZone(obj, plan) {
  const c = objCenter(obj);
  const col = c.x < plan.width / 3 ? 0 : c.x < plan.width * 2 / 3 ? 1 : 2;
  const row = c.z < plan.depth / 3 ? 0 : c.z < plan.depth * 2 / 3 ? 1 : 2;
  const map = [
    ["knowledge", "career", "helpful people"],
    ["family", "health", "creativity"],
    ["wealth", "fame", "relationships"],
  ];
  return map[row][col];
}

function baguaZoneAt(col, row) {
  const map = [
    ["knowledge", "career", "helpful people"],
    ["family", "health", "creativity"],
    ["wealth", "fame", "relationships"],
  ];
  return map[row]?.[col] || "health";
}

function objectElement(label) {
  const map = {
    bed: "wood", couch: "wood", chair: "wood", dresser: "wood", nightstand: "wood", wardrobe: "wood", desk: "wood", bookshelf: "wood", "tv stand": "metal",
    "dining table": "earth", "patio table": "earth", "kitchen island": "earth",
    refrigerator: "metal", dishwasher: "metal", oven: "fire", grill: "fire",
    sink: "water", bathtub: "water", shower: "water", toilet: "water",
    "bathroom cabinet": "wood", "patio chair": "wood", "lounge chair": "wood", planter: "earth",
  };
  return map[normalizeLabel(label)] || "earth";
}

function buildFengShuiModel(plan, layout, analysis) {
  const W = plan.width;
  const D = plan.depth;
  const roomArea = W * D;
  const roomType = analysis?.roomType || "";
  const door = layout?.openings?.find((o) => o.type === "door") || null;
  const entrance = layout?.openings?.find((o) => o.type === "entrance") || null;
  const windows = (layout?.openings || []).filter((o) => o.type === "window");
  const mainDoor = entrance || door;
  const dp = doorPoint(mainDoor, plan);
  const corridor = entryCorridor(plan, dp);
  const bed = plan.objects.find((o) => normalizeLabel(o.label) === "bed") || null;
  const couch = plan.objects.find((o) => normalizeLabel(o.label) === "couch") || null;
  const stove = plan.objects.find((o) => normalizeLabel(o.label) === "oven" || normalizeLabel(o.label) === "grill") || null;
  const sinkObj = plan.objects.find((o) => normalizeLabel(o.label) === "sink") || null;
  const fridge = plan.objects.find((o) => normalizeLabel(o.label) === "refrigerator") || null;
  const toilet = plan.objects.find((o) => normalizeLabel(o.label) === "toilet") || null;
  const isBedroom = roomType.includes("bedroom");

  const findings = [];
  const recommendations = [];
  let score = 50;

  // ── 1. Command Position ──
  const anchor = bed || couch;
  if (anchor) {
    const ac = objCenter(anchor);
    const canSeeDoor = dp ? (anchor.zone === "back" || distToPoint(ac, dp) > Math.max(W, D) * 0.35) : true;
    const backedByWall = isAgainstAnyWall(anchor, plan);
    const notInLineDoor = dp ? !(Math.abs(ac.x - dp.x) < anchor.width * 0.6 && Math.abs(ac.z - dp.z) < anchor.depth * 0.6) : true;
    if (backedByWall && canSeeDoor && notInLineDoor) {
      findings.push({ level: "good", text: `${anchor.label} is in a strong command position — backed by a wall with sightline to the door.` });
      score += 12;
    } else {
      if (!backedByWall) {
        findings.push({ level: "warn", text: `${anchor.label} is floating without wall support, weakening the command position.` });
        recommendations.push(`Move the ${anchor.label} so its back rests against a solid wall.`);
        score -= 8;
      }
      if (!canSeeDoor) {
        findings.push({ level: "warn", text: `${anchor.label} cannot see the door, reducing sense of security.` });
        recommendations.push(`Reposition the ${anchor.label} so you can see the entrance from it.`);
        score -= 6;
      }
      if (!notInLineDoor) {
        findings.push({ level: "warn", text: `${anchor.label} is directly in line with the door ("coffin position").` });
        recommendations.push(`Shift the ${anchor.label} so it is not directly aligned with the doorway.`);
        score -= 10;
      }
    }
  } else {
    findings.push({ level: "note", text: "No anchor furniture (bed or couch) detected for command position analysis." });
    score -= 4;
  }

  // ── 2. Five Elements Balance ──
  const elementCounts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const obj of plan.objects) elementCounts[objectElement(obj.label)] += 1;
  const total = plan.objects.length || 1;
  const elementList = Object.entries(elementCounts);
  const present = elementList.filter(([, c]) => c > 0);
  const missing = elementList.filter(([, c]) => c === 0).map(([e]) => e);
  const dominant = elementList.reduce((a, b) => b[1] > a[1] ? b : a, ["", 0]);
  if (present.length >= 4) {
    findings.push({ level: "good", text: `Good elemental diversity — ${present.length}/5 elements represented.` });
    score += 6;
  } else if (present.length <= 2) {
    findings.push({ level: "warn", text: `Only ${present.length} element(s) present — the space lacks balance.` });
    score -= 6;
  }
  if (missing.length > 0 && missing.length <= 3) {
    const hints = { wood: "plants or wooden furniture", fire: "candles, warm lighting, or red accents", earth: "ceramics, stone, or earth-tone textiles", metal: "metal frames, white/grey decor", water: "a small fountain, mirror, or dark blue accents" };
    recommendations.push(`Missing element(s): ${missing.map((e) => `${e} (add ${hints[e]})`).join("; ")}.`);
  }
  if (dominant[1] / total > 0.55 && total > 2) {
    findings.push({ level: "note", text: `${dominant[0]} element is dominant (${dominant[1]}/${total} items). Consider balancing with its cycle neighbors.` });
    score -= 3;
  }
  const elements = { counts: elementCounts, missing, dominant: dominant[0] };

  // ── 3. Bagua Map ──
  const baguaCounts = {};
  for (const obj of plan.objects) {
    const zone = baguaZone(obj, plan);
    baguaCounts[zone] = (baguaCounts[zone] || 0) + 1;
  }
  const baguaGrid = [];
  for (let row = 0; row < 3; row++) {
    const r = [];
    for (let col = 0; col < 3; col++) {
      const name = baguaZoneAt(col, row);
      r.push({ name, count: baguaCounts[name] || 0 });
    }
    baguaGrid.push(r);
  }
  const healthZoneLoad = plan.objects
    .filter((o) => baguaZone(o, plan) === "health")
    .reduce((s, o) => s + o.width * o.depth, 0);
  if (healthZoneLoad / roomArea > 0.12) {
    findings.push({ level: "warn", text: "The health/center bagua zone is cluttered — keep this area open for balanced qi." });
    recommendations.push("Clear the center of the room to strengthen the health zone.");
    score -= 8;
  } else {
    findings.push({ level: "good", text: "The center (health) bagua zone is open, supporting balanced energy." });
    score += 5;
  }
  const wealthZone = plan.objects.filter((o) => baguaZone(o, plan) === "wealth");
  if (wealthZone.length > 0) {
    findings.push({ level: "good", text: `Wealth corner is activated with ${wealthZone.length} item(s).` });
    score += 3;
  } else {
    findings.push({ level: "note", text: "Wealth corner (far-left from entrance) is empty." });
    recommendations.push("Place a plant, lamp, or meaningful object in the far-left corner to activate the wealth zone.");
  }

  // ── 4. Qi Flow / Entry Path ──
  if (corridor) {
    const blocked = plan.objects.some((o) => overlapsRect({ x: o.x, z: o.z, width: o.width, depth: o.depth }, corridor, 0.02));
    if (blocked) {
      findings.push({ level: "warn", text: "Furniture blocks the qi flow path from the entrance." });
      recommendations.push("Clear a path from the door into the room so energy can circulate freely.");
      score -= 10;
    } else {
      findings.push({ level: "good", text: "The entry path is clear — qi can flow into the room." });
      score += 6;
    }
  }

  // ── 5. Yin/Yang Balance ──
  const tallItems = plan.objects.filter((o) => o.height > plan.height * 0.5);
  const lowItems = plan.objects.filter((o) => o.height <= plan.height * 0.3);
  if (isBedroom) {
    if (tallItems.length > lowItems.length + 1) {
      findings.push({ level: "note", text: "Bedroom has many tall items — excess yang energy for a rest space." });
      recommendations.push("Bedrooms favor yin energy: lower furniture, soft textures, and muted colors.");
      score -= 4;
    } else {
      findings.push({ level: "good", text: "Bedroom has a calm yin-dominant balance suitable for rest." });
      score += 4;
    }
  } else if (plan.objects.length > 0 && tallItems.length === 0 && lowItems.length === plan.objects.length) {
    findings.push({ level: "note", text: "All furniture is low — adding a taller piece can introduce activating yang energy." });
  }

  // ── 6. Poison Arrows ──
  let poisonCount = 0;
  for (let i = 0; i < plan.objects.length; i++) {
    for (let j = i + 1; j < plan.objects.length; j++) {
      const dist = distToPoint(objCenter(plan.objects[i]), objCenter(plan.objects[j]));
      if (dist < Math.max(plan.objects[i].width, plan.objects[i].depth) * 1.2 && dist > 0.1) poisonCount++;
    }
  }
  if (poisonCount > 0) {
    findings.push({ level: "note", text: `${poisonCount} furniture pair(s) have sharp corners pointing at each other (poison arrows).` });
    recommendations.push("Soften sharp corners between close furniture with plants, fabric, or rounded objects.");
    score -= Math.min(poisonCount * 3, 9);
  }
  if (anchor) {
    const ac = objCenter(anchor);
    const corners = [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: D }, { x: 0, z: D }];
    if (corners.some((c) => distToPoint(ac, c) < Math.max(W, D) * 0.25)) {
      findings.push({ level: "note", text: `${anchor.label} is close to a room corner — sha qi may be directed at it.` });
      recommendations.push("Place a plant or screen near the corner to diffuse sha qi.");
      score -= 3;
    }
  }

  // ── 7. Bed-Specific Rules ──
  if (bed) {
    const windowOnOppWall = windows.some((w) => {
      if (mainDoor?.wall === "front" && w.wall === "back") return true;
      if (mainDoor?.wall === "back" && w.wall === "front") return true;
      if (mainDoor?.wall === "left" && w.wall === "right") return true;
      if (mainDoor?.wall === "right" && w.wall === "left") return true;
      return false;
    });
    if (windowOnOppWall) {
      const bc = objCenter(bed);
      if (Math.abs(bc.x - W / 2) < W * 0.2 && Math.abs(bc.z - D / 2) < D * 0.2) {
        findings.push({ level: "warn", text: "Bed is between the door and a window — qi rushes through without settling." });
        recommendations.push("Move the bed out of the direct line between door and window.");
        score -= 7;
      }
    }
    if (isAgainstWall(bed, plan, "back")) {
      findings.push({ level: "good", text: "Bed headboard is against a solid wall — strong support energy." });
      score += 4;
    }
  }

  // ── 8. Kitchen Triangle ──
  if (stove && sinkObj) {
    const sd = distToPoint(objCenter(stove), objCenter(sinkObj));
    if (sd < 0.5) {
      findings.push({ level: "warn", text: "Stove (fire) and sink (water) are too close — conflicting elements." });
      recommendations.push("Separate stove and sink or place a wood-element item between them.");
      score -= 7;
    } else {
      findings.push({ level: "good", text: "Stove and sink have adequate separation — fire/water balanced." });
      score += 4;
    }
    if (fridge && distToPoint(objCenter(stove), objCenter(fridge)) > 0.6 && distToPoint(objCenter(sinkObj), objCenter(fridge)) > 0.6 && sd > 0.5) {
      findings.push({ level: "good", text: "Kitchen work triangle (stove, sink, fridge) is well-spaced." });
      score += 4;
    }
  }
  if (stove && dp) {
    const sc = objCenter(stove);
    if (Math.abs(sc.x - dp.x) < stove.width && Math.abs(sc.z - dp.z) < D * 0.3) {
      findings.push({ level: "note", text: "Cook's back faces the door — weakens command position at the stove." });
      recommendations.push("Place a small mirror behind the stove so the cook can see the door.");
      score -= 4;
    }
  }

  // ── 9. Bathroom Rules ──
  if (toilet) {
    if (dp && distToPoint(objCenter(toilet), dp) < Math.max(W, D) * 0.25) {
      findings.push({ level: "warn", text: "Toilet is too close to the entrance — draining energy." });
      recommendations.push("Keep the bathroom door closed or add a screen to separate the toilet from the entry.");
      score -= 6;
    }
    if (toilet.zone === "center" && toilet.sideZone === "center") {
      findings.push({ level: "warn", text: "Toilet in the center of the space drains the health zone." });
      score -= 5;
    }
  }

  // ── 10. Clutter & Symmetry ──
  const fillRatio = plan.objects.reduce((s, o) => s + o.width * o.depth, 0) / roomArea;
  if (fillRatio > 0.45) {
    findings.push({ level: "warn", text: `Room is ${Math.round(fillRatio * 100)}% filled — too cluttered for healthy qi.` });
    recommendations.push("Remove or downsize furniture to keep floor coverage under 40–45%.");
    score -= 8;
  } else if (fillRatio > 0.3) {
    findings.push({ level: "note", text: `Room is ${Math.round(fillRatio * 100)}% filled — approaching the upper limit.` });
    score -= 2;
  } else {
    findings.push({ level: "good", text: `Room is ${Math.round(fillRatio * 100)}% filled — good breathing room for qi.` });
    score += 4;
  }
  const leftMass = plan.objects.filter((o) => objCenter(o).x < W / 2).reduce((s, o) => s + o.width * o.depth, 0);
  const rightMass = plan.objects.filter((o) => objCenter(o).x >= W / 2).reduce((s, o) => s + o.width * o.depth, 0);
  if (Math.abs(leftMass - rightMass) / (leftMass + rightMass || 1) > 0.6 && plan.objects.length > 2) {
    findings.push({ level: "note", text: `Furniture is heavily weighted to the ${leftMass > rightMass ? "left" : "right"} side.` });
    score -= 4;
  }

  // ── 11. Lighting ──
  if (analysis?.lighting === "dim interior light") {
    findings.push({ level: "note", text: "Dim lighting creates stagnant yin energy." });
    recommendations.push("Add layered lighting — especially in dark corners — to activate qi flow.");
    score -= 4;
  } else if (analysis?.lighting?.includes("bright") || analysis?.lighting?.includes("natural")) {
    findings.push({ level: "good", text: "Good natural or bright lighting supports active qi." });
    score += 3;
  }

  score = clamp(Math.round(score), 10, 98);
  const verdict = score >= 82 ? "excellent harmony"
    : score >= 68 ? "good balance"
    : score >= 50 ? "workable — room for improvement"
    : "needs significant adjustment";

  return { score, verdict, findings, recommendations, elements, baguaGrid };
}

function renderFloorPlan() {
  const canvas = els.planCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const dark = document.documentElement.getAttribute("data-theme") === "dark";

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, dark ? "#1a1d26" : "#fcfdff");
  grad.addColorStop(1, dark ? "#14161e" : "#f1ede5");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  if (!state.floorPlan) {
    ctx.fillStyle = dark ? "rgba(226,228,234,0.6)" : "rgba(58,47,38,0.6)";
    ctx.font = "600 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("2D Floor Plan", cw / 2, ch / 2 - 10);
    ctx.font = "400 16px 'Space Grotesk', sans-serif";
    ctx.fillText("Generate a room model to solve the top view first", cw / 2, ch / 2 + 18);
    return;
  }

  const plan = state.floorPlan;
  const tf = derivePlanCanvasTransform(plan, canvas);

  function toCanvas(x, z) {
    return { x: tf.ox + x * tf.scale, y: tf.oy + z * tf.scale };
  }

  const wall = plan.wallThickness * tf.scale;
  const outer = toCanvas(0, 0);
  // Draw room boundary (polygon or rectangle)
  const bnd = plan.boundary;
  const isRect = bnd.length === 4 && bnd[0].x === 0 && bnd[0].z === 0 && bnd[1].x === plan.width && bnd[1].z === 0 && bnd[2].x === plan.width && bnd[2].z === plan.depth && bnd[3].x === 0 && bnd[3].z === plan.depth;
  ctx.fillStyle = dark ? "rgba(30, 33, 42, 0.95)" : "rgba(238, 232, 222, 0.95)";
  ctx.strokeStyle = dark ? "#6b7a94" : "#2f3d5c";
  ctx.lineWidth = 2;
  if (isRect) {
    ctx.fillRect(outer.x, outer.y, plan.width * tf.scale, plan.depth * tf.scale);
    ctx.strokeRect(outer.x, outer.y, plan.width * tf.scale, plan.depth * tf.scale);
  } else {
    ctx.beginPath();
    for (let i = 0; i < bnd.length; i++) {
      const p = toCanvas(bnd[i].x, bnd[i].z);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Draw wall thickness along boundary edges
  ctx.fillStyle = "rgba(41,84,209,0.12)";
  for (let i = 0; i < bnd.length; i++) {
    const a = toCanvas(bnd[i].x, bnd[i].z);
    const b = toCanvas(bnd[(i + 1) % bnd.length].x, bnd[(i + 1) % bnd.length].z);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dy / len * wall;
    const ny = -dx / len * wall;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + nx, b.y + ny);
    ctx.lineTo(a.x + nx, a.y + ny);
    ctx.closePath();
    ctx.fill();
  }

  for (const obj of plan.objects) {
    const p = toCanvas(obj.x, obj.z);
    const w = obj.width * tf.scale;
    const d = obj.depth * tf.scale;
    const cx = p.x + w / 2;
    const cy = p.y + d / 2;
    const rot = obj.rotation || 0;
    const dir = (((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4);
    const isSelected = state.selectedObjectIndex >= 0 && plan.objects[state.selectedObjectIndex] === obj;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = `rgb(${obj.color[0]},${obj.color[1]},${obj.color[2]})`;
    ctx.strokeStyle = isSelected ? "rgba(22, 28, 42, 0.95)" : "rgba(34, 41, 60, 0.35)";
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    ctx.strokeStyle = "rgba(22, 28, 42, 0.62)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -d / 2 + 6);
    ctx.lineTo(0, -d / 2 + Math.min(18, d * 0.34));
    ctx.stroke();
    ctx.fillStyle = "rgba(22, 28, 42, 0.82)";
    ctx.font = "600 11px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(obj.label, -w / 2 + 6, -d / 2 + 15);
    if (isSelected) {
      const hs = 6;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(22, 28, 42, 0.9)";
      ctx.lineWidth = 2;
      for (const [hx, hy] of [[-w/2, -d/2], [w/2, -d/2], [w/2, d/2], [-w/2, d/2]]) {
        ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
        ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
      }
    }
    ctx.restore();
  }

  for (const opening of plan.openings || []) {
    if (opening.type === "entrance") {
      const p = toCanvas(opening.x, opening.z);
      ctx.fillStyle = "rgba(234, 94, 40, 0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(22, 28, 42, 0.82)";
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.fillText("entrance", p.x + 10, p.y - 6);
      continue;
    }
    ctx.strokeStyle = opening.type === "door" ? "rgba(34, 139, 34, 0.9)" : "rgba(41,84,209,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (opening.wall === "front") {
      const a = toCanvas(opening.x, 0);
      const b = toCanvas(opening.x + opening.width, 0);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    } else if (opening.wall === "back") {
      const a = toCanvas(opening.x, plan.depth);
      const b = toCanvas(opening.x + opening.width, plan.depth);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    } else if (opening.wall === "left") {
      const a = toCanvas(0, opening.z);
      const b = toCanvas(0, opening.z + opening.width);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    } else {
      const a = toCanvas(plan.width, opening.z);
      const b = toCanvas(plan.width, opening.z + opening.width);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  drawPlanCompass(ctx, cw - 64, 64);

  ctx.fillStyle = dark ? "rgba(226,228,234,0.72)" : "rgba(22, 28, 42, 0.72)";
  ctx.font = "600 16px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${mToFtIn(plan.width)} × ${mToFtIn(plan.depth)} · ${state.planView.zoom.toFixed(1)}x`, 18, 28);
}

function drawPlanCompass(ctx, cx, cy) {
  const radius = 28;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "rgba(255, 253, 249, 0.88)";
  ctx.strokeStyle = "rgba(34, 41, 60, 0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(34, 41, 60, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 6);
  ctx.lineTo(0, radius - 6);
  ctx.moveTo(-radius + 6, 0);
  ctx.lineTo(radius - 6, 0);
  ctx.stroke();

  ctx.fillStyle = "#2954d1";
  ctx.beginPath();
  ctx.moveTo(0, -radius + 5);
  ctx.lineTo(5, -6);
  ctx.lineTo(0, -1);
  ctx.lineTo(-5, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(22, 28, 42, 0.82)";
  ctx.font = "700 11px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, -radius - 10);
  ctx.fillText("E", radius + 10, 0);
  ctx.fillText("S", 0, radius + 10);
  ctx.fillText("W", -radius - 10, 0);

  ctx.restore();
}

function buildMeshFromFloorPlan(plan, opts, colors) {
  const s = opts.scale;
  const W = plan.width * s;
  const D = plan.depth * s;
  const H = plan.height * s;
  const wall = plan.wallThickness * s;
  const floorThickness = Math.max(wall, 0.06 * s);
  const ceilingBand = Math.min(Math.max(0.12 * s, wall * 0.9), H * 0.16);
  const verts = [];
  const norms = [];
  const faceColors = [];
  let triCount = 0;
  let currentColor = [180, 180, 180];

  function tri(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    verts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    norms.push(nx, ny, nz);
    faceColors.push(currentColor[0], currentColor[1], currentColor[2]);
    triCount += 1;
  }

  function box(x, y, z, w, h, d) {
    if (w <= 1e-6 || h <= 1e-6 || d <= 1e-6) return;
    tri(x, y, z, x + w, y, z, x + w, y + h, z);
    tri(x, y, z, x + w, y + h, z, x, y + h, z);
    tri(x, y, z + d, x + w, y + h, z + d, x + w, y, z + d);
    tri(x, y, z + d, x, y + h, z + d, x + w, y + h, z + d);
    tri(x, y, z, x, y + h, z, x, y + h, z + d);
    tri(x, y, z, x, y + h, z + d, x, y, z + d);
    tri(x + w, y, z, x + w, y + h, z + d, x + w, y + h, z);
    tri(x + w, y, z, x + w, y, z + d, x + w, y + h, z + d);
    tri(x, y + h, z, x + w, y + h, z, x + w, y + h, z + d);
    tri(x, y + h, z, x + w, y + h, z + d, x, y + h, z + d);
    tri(x, y, z, x + w, y, z + d, x + w, y, z);
    tri(x, y, z, x, y, z + d, x + w, y, z + d);
  }

  function normalizeOpeningsForWall(wallName, axisLength) {
    return (plan.openings || [])
      .filter((opening) => opening.wall === wallName && opening.type !== "entrance")
      .map((opening) => {
        const start = wallName === "front" || wallName === "back" ? opening.x * s : opening.z * s;
        const width = Math.max(0, opening.width * s);
        const isDoor = opening.type === "door";
        const openingHeight = isDoor
          ? clamp(H * 0.78, Math.min(H, 1.95 * s), H)
          : clamp(H * 0.34, Math.min(H * 0.5, 0.9 * s), Math.min(H * 0.7, 1.2 * s));
        const sillHeight = isDoor ? 0 : clamp(H * 0.34, 0.75 * s, Math.max(0, H - openingHeight - 0.2 * s));
        return {
          start: clamp(start, 0, axisLength),
          end: clamp(start + width, 0, axisLength),
          sillHeight,
          topHeight: clamp(sillHeight + openingHeight, 0, H),
        };
      })
      .filter((opening) => opening.end - opening.start > wall * 0.25)
      .sort((a, b) => a.start - b.start);
  }

  function collectWallCuts(openings) {
    const cuts = [0, H];
    for (const opening of openings) {
      cuts.push(opening.sillHeight, opening.topHeight);
    }
    return [...new Set(cuts.map((value) => clamp(value, 0, H)).sort((a, b) => a - b))];
  }

  function addHorizontalWallWithOpenings(z, wallName, color) {
    const openings = normalizeOpeningsForWall(wallName, W);
    const yCuts = collectWallCuts(openings);
    currentColor = color;
    for (let i = 0; i < yCuts.length - 1; i += 1) {
      const y0 = yCuts[i];
      const y1 = yCuts[i + 1];
      const bandHeight = y1 - y0;
      if (bandHeight <= 1e-6) continue;
      const bandOpenings = openings.filter((opening) => opening.sillHeight <= y0 && opening.topHeight >= y1);
      let cursor = 0;
      for (const opening of bandOpenings) {
        const segStart = clamp(opening.start, 0, W);
        const segEnd = clamp(opening.end, 0, W);
        if (segStart > cursor) {
          box(cursor, y0, z, segStart - cursor, bandHeight, wall);
        }
        cursor = Math.max(cursor, segEnd);
      }
      if (cursor < W) {
        box(cursor, y0, z, W - cursor, bandHeight, wall);
      }
    }
  }

  function addVerticalWallWithOpenings(x, wallName, color) {
    const openings = normalizeOpeningsForWall(wallName, D);
    const yCuts = collectWallCuts(openings);
    currentColor = color;
    for (let i = 0; i < yCuts.length - 1; i += 1) {
      const y0 = yCuts[i];
      const y1 = yCuts[i + 1];
      const bandHeight = y1 - y0;
      if (bandHeight <= 1e-6) continue;
      const bandOpenings = openings.filter((opening) => opening.sillHeight <= y0 && opening.topHeight >= y1);
      let cursor = 0;
      for (const opening of bandOpenings) {
        const segStart = clamp(opening.start, 0, D);
        const segEnd = clamp(opening.end, 0, D);
        if (segStart > cursor) {
          box(x, y0, cursor, wall, bandHeight, segStart - cursor);
        }
        cursor = Math.max(cursor, segEnd);
      }
      if (cursor < D) {
        box(x, y0, cursor, wall, bandHeight, D - cursor);
      }
    }
  }

  function addCeilingRing(color) {
    currentColor = color;
    box(0, H - ceilingBand, 0, W, ceilingBand, wall);
    box(0, H - ceilingBand, D - wall, W, ceilingBand, wall);
    box(0, H - ceilingBand, wall, wall, ceilingBand, Math.max(0, D - wall * 2));
    box(W - wall, H - ceilingBand, wall, wall, ceilingBand, Math.max(0, D - wall * 2));
  }

  function addFurnitureMass(object) {
    const x = object.x * s;
    const z = object.z * s;
    const w = object.width * s;
    const d = object.depth * s;
    const h = Math.max(object.height * s, 0.18 * s);
    const y = floorThickness;
    const insetX = Math.min(w * 0.14, 0.12 * s);
    const insetZ = Math.min(d * 0.14, 0.12 * s);
    const label = normalizeLabel(object.label);

    currentColor = object.color;

    if (label === "bed") {
      const baseH = h * 0.42;
      const mattressH = h * 0.38;
      const headboardH = Math.max(h * 0.95, 0.7 * s);
      box(x, y, z, w, baseH, d);
      box(x + insetX * 0.6, y + baseH, z + insetZ * 0.4, Math.max(w - insetX * 1.2, wall), mattressH, Math.max(d - insetZ * 0.8, wall));
      box(x, y + baseH, z + d - wall * 0.7, w, Math.max(headboardH - baseH, wall), wall * 0.7);
      return;
    }

    if (label === "couch") {
      const seatH = h * 0.45;
      const backH = h * 0.5;
      const armW = Math.min(w * 0.12, 0.14 * s);
      box(x, y, z, w, seatH, d);
      box(x, y + seatH, z + d - wall * 0.8, w, backH, wall * 0.8);
      box(x, y + seatH * 0.25, z, armW, seatH * 0.9, d);
      box(x + w - armW, y + seatH * 0.25, z, armW, seatH * 0.9, d);
      return;
    }

    if (label.includes("table")) {
      const topH = Math.max(h * 0.12, wall * 0.7);
      const legW = Math.min(w * 0.14, 0.1 * s);
      const legD = Math.min(d * 0.14, 0.1 * s);
      const legH = Math.max(h - topH, 0.24 * s);
      box(x, y + legH, z, w, topH, d);
      box(x, y, z, legW, legH, legD);
      box(x + w - legW, y, z, legW, legH, legD);
      box(x, y, z + d - legD, legW, legH, legD);
      box(x + w - legW, y, z + d - legD, legW, legH, legD);
      return;
    }

    if (label === "chair") {
      const seatH = h * 0.45;
      const backH = h * 0.42;
      const legW = Math.min(w * 0.16, 0.08 * s);
      const legD = Math.min(d * 0.16, 0.08 * s);
      box(x + insetX * 0.5, y + seatH, z + insetZ * 0.5, Math.max(w - insetX, wall), h * 0.12, Math.max(d - insetZ, wall));
      box(x + insetX * 0.5, y + seatH, z + d - wall * 0.65, Math.max(w - insetX, wall), backH, wall * 0.65);
      box(x, y, z, legW, seatH, legD);
      box(x + w - legW, y, z, legW, seatH, legD);
      box(x, y, z + d - legD, legW, seatH, legD);
      box(x + w - legW, y, z + d - legD, legW, seatH, legD);
      return;
    }

    if (label === "refrigerator" || label === "oven" || label === "sink" || label === "toilet") {
      box(x, y, z, w, h, d);
      return;
    }

    const baseH = h * 0.82;
    box(x, y, z, w, baseH, d);
    box(x + insetX, y + baseH, z + insetZ, Math.max(w - insetX * 2, wall), Math.max(h - baseH, wall * 0.6), Math.max(d - insetZ * 2, wall));
  }

  currentColor = colors.floor || [160, 140, 120];
  const bnd = plan.boundary;
  const isRect = bnd.length === 4 && bnd[0].x === 0 && bnd[0].z === 0 && bnd[1].x === plan.width && bnd[1].z === 0 && bnd[2].x === plan.width && bnd[2].z === plan.depth && bnd[3].x === 0 && bnd[3].z === plan.depth;

  if (isRect) {
    box(0, 0, 0, W, floorThickness, D);
    addVerticalWallWithOpenings(0, "left", colors.leftWall || [190, 185, 175]);
    addVerticalWallWithOpenings(W - wall, "right", colors.rightWall || [190, 185, 175]);
    addHorizontalWallWithOpenings(0, "front", colors.backWall || [200, 195, 185]);
    addHorizontalWallWithOpenings(D - wall, "back", colors.backWall || [200, 195, 185]);
    addCeilingRing(colors.backWall || [200, 195, 185]);
  } else {
    // Polygon floor as triangle fan
    currentColor = colors.floor || [160, 140, 120];
    const cx = bnd.reduce((s, p) => s + p.x, 0) / bnd.length * s;
    const cz = bnd.reduce((s, p) => s + p.z, 0) / bnd.length * s;
    for (let i = 0; i < bnd.length; i++) {
      const a = bnd[i];
      const b = bnd[(i + 1) % bnd.length];
      tri(cx, floorThickness, cz, a.x * s, floorThickness, a.z * s, b.x * s, floorThickness, b.z * s);
      tri(cx, 0, cz, b.x * s, 0, b.z * s, a.x * s, 0, a.z * s);
    }
    // Polygon walls along each edge
    const wallColor = colors.backWall || [200, 195, 185];
    currentColor = wallColor;
    for (let i = 0; i < bnd.length; i++) {
      const a = bnd[i];
      const b = bnd[(i + 1) % bnd.length];
      const ax = a.x * s, az = a.z * s, bx = b.x * s, bz = b.z * s;
      // Outer face
      tri(ax, 0, az, bx, 0, bz, bx, H, bz);
      tri(ax, 0, az, bx, H, bz, ax, H, az);
      // Inner face (offset inward by wall thickness)
      const edx = bx - ax, edz = bz - az;
      const elen = Math.sqrt(edx * edx + edz * edz) || 1;
      const nx = edz / elen * wall, nz = -edx / elen * wall;
      tri(ax + nx, 0, az + nz, bx + nx, H, bz + nz, bx + nx, 0, bz + nz);
      tri(ax + nx, 0, az + nz, ax + nx, H, az + nz, bx + nx, H, bz + nz);
      // Top cap
      tri(ax, H, az, bx, H, bz, bx + nx, H, bz + nz);
      tri(ax, H, az, bx + nx, H, bz + nz, ax + nx, H, az + nz);
    }
  }

  for (const obj of plan.objects) {
    addFurnitureMass(obj);
  }

  return {
    vertices: new Float32Array(verts),
    normals: new Float32Array(norms),
    colors: new Uint8Array(faceColors),
    triCount,
    objects: plan.objects,
  };
}

function cleanMesh(mesh) {
  const { vertices, normals, colors, triCount, objects } = mesh;
  let good = 0;
  for (let i = 0; i < triCount; i += 1) {
    const vi = i * 9;
    const ux = vertices[vi + 3] - vertices[vi];
    const uy = vertices[vi + 4] - vertices[vi + 1];
    const uz = vertices[vi + 5] - vertices[vi + 2];
    const vx = vertices[vi + 6] - vertices[vi];
    const vy = vertices[vi + 7] - vertices[vi + 1];
    const vz = vertices[vi + 8] - vertices[vi + 2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz) < 1e-10) continue;
    if (good !== i) {
      const gi = good * 9;
      const ni = good * 3;
      const si = i * 3;
      for (let j = 0; j < 9; j += 1) vertices[gi + j] = vertices[vi + j];
      normals[ni] = normals[si];
      normals[ni + 1] = normals[si + 1];
      normals[ni + 2] = normals[si + 2];
      colors[ni] = colors[si];
      colors[ni + 1] = colors[si + 1];
      colors[ni + 2] = colors[si + 2];
    }
    good += 1;
  }
  return {
    vertices: vertices.slice(0, good * 9),
    normals: normals.slice(0, good * 3),
    colors: colors.slice(0, good * 3),
    triCount: good,
    objects,
  };
}

function renderPreview() {
  syncThreePreview();
  renderThreePreview();
}

function initThreePreview() {
  const renderer = new THREE.WebGLRenderer({
    canvas: els.modelCanvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf8fafe, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafe);
  scene.fog = new THREE.Fog(0xf8fafe, 8, 28);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(6.6, 5.2, 7.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(2.5, 1.1, 2.4);
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 30;

  const ambient = new THREE.HemisphereLight(0xf8fbff, 0xc7b8a2, 1.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(6, 9, 4);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf3d6b4, 0.45);
  fill.position.set(-5, 4, -3);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  renderer.setAnimationLoop(renderThreePreview);

  return { renderer, scene, camera, controls, root, signature: "", roomSignature: "" };
}

function handleThreePreviewResize() {
  const width = els.modelCanvas.clientWidth || els.modelCanvas.width;
  const height = els.modelCanvas.clientHeight || els.modelCanvas.height;
  if (!width || !height) return;
  threePreview.renderer.setSize(width, height, false);
  threePreview.camera.aspect = width / height;
  threePreview.camera.updateProjectionMatrix();
  renderThreePreview();
}

function syncThreePreview() {
  const roomSignature = JSON.stringify({
    room: state.roomModel ? {
      width: state.roomModel.width,
      depth: state.roomModel.depth,
      height: state.roomModel.height,
    } : null,
    scale: state.opts.scale,
  });
  const signature = JSON.stringify({
    room: roomSignature,
    objects: state.floorPlan?.objects ?? [],
    openings: state.floorPlan?.openings ?? [],
    selected: state.selectedObjectIndex,
  });
  if (signature === threePreview.signature) return;
  const resetCamera = roomSignature !== threePreview.roomSignature;
  threePreview.signature = signature;
  threePreview.roomSignature = roomSignature;
  rebuildThreePreviewScene(resetCamera);
}

function rebuildThreePreviewScene(resetCamera = false) {
  const { root, controls, camera } = threePreview;
  root.clear();
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);

  if (!state.roomModel || !state.floorPlan) {
    controls.target.set(2.5, 1.1, 2.4);
    camera.position.set(6.6, 5.2, 7.4);
    controls.update();
    return;
  }

  const plan = state.floorPlan;
  const s = state.opts.scale;
  const wall = plan.wallThickness * s;
  const floorThickness = Math.max(wall, 0.06 * s);
  const roomWidth = plan.width * s;
  const roomDepth = plan.depth * s;
  const roomHeight = plan.height * s;


  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: rgbToHex(plan.colors?.floor || [160, 140, 120]), roughness: 0.92, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ color: rgbToHex(plan.colors?.backWall || [206, 198, 188]), roughness: 0.95, side: THREE.DoubleSide }),
    leftWall: new THREE.MeshStandardMaterial({ color: rgbToHex(plan.colors?.leftWall || [190, 185, 175]), roughness: 0.95, side: THREE.DoubleSide }),
    rightWall: new THREE.MeshStandardMaterial({ color: rgbToHex(plan.colors?.rightWall || [190, 185, 175]), roughness: 0.95, side: THREE.DoubleSide }),
    openingDoor: new THREE.MeshStandardMaterial({ color: 0x3c7e42, roughness: 0.85, side: THREE.DoubleSide }),
    openingWindow: new THREE.MeshStandardMaterial({ color: 0x7ea9d8, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide }),
  };

  const bnd = plan.boundary;
  const isRect = bnd.length === 4 && bnd[0].x === 0 && bnd[0].z === 0 && bnd[1].x === plan.width && bnd[1].z === 0 && bnd[2].x === plan.width && bnd[2].z === plan.depth && bnd[3].x === 0 && bnd[3].z === plan.depth;

  if (isRect) {
    addBoxMesh(root, roomWidth / 2, floorThickness / 2, roomDepth / 2, roomWidth, floorThickness, roomDepth, materials.floor);
    addWallPreview(root, "front", 0, roomWidth, roomHeight, wall, materials.wall, plan.openings || []);
    addWallPreview(root, "back", roomDepth - wall, roomWidth, roomHeight, wall, materials.wall, plan.openings || []);
    addWallPreview(root, "left", 0, roomDepth, roomHeight, wall, materials.leftWall, plan.openings || []);
    addWallPreview(root, "right", roomWidth - wall, roomDepth, roomHeight, wall, materials.rightWall, plan.openings || []);
  } else {
    // Polygon floor with thickness using ExtrudeGeometry
    const shape = new THREE.Shape();
    shape.moveTo(bnd[0].x * s, bnd[0].z * s);
    for (let i = 1; i < bnd.length; i++) shape.lineTo(bnd[i].x * s, bnd[i].z * s);
    shape.closePath();
    const floorGeo = new THREE.ExtrudeGeometry(shape, { depth: floorThickness, bevelEnabled: false });
    floorGeo.rotateX(-Math.PI / 2);
    root.add(new THREE.Mesh(floorGeo, materials.floor));
    // Polygon walls
    for (let i = 0; i < bnd.length; i++) {
      const a = bnd[i], b = bnd[(i + 1) % bnd.length];
      const ax = a.x * s, az = a.z * s, bx = b.x * s, bz = b.z * s;
      const edgeLen = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
      if (edgeLen < 0.01) continue;
      const wallGeo = new THREE.BoxGeometry(edgeLen, roomHeight, wall);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const angle = Math.atan2(bz - az, bx - ax);
      const wallMesh = new THREE.Mesh(wallGeo, materials.wall);
      wallMesh.position.set(mx, roomHeight / 2, mz);
      wallMesh.rotation.y = -angle;
      root.add(wallMesh);
    }
  }

  for (let i = 0; i < plan.objects.length; i += 1) {
    addFurniturePreview(root, plan.objects[i], i === state.selectedObjectIndex, floorThickness, s);
  }

  for (const opening of plan.openings || []) {
    if (opening.type === "entrance") {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 * s, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xea5e28, emissive: 0x4a1305, emissiveIntensity: 0.2, side: THREE.DoubleSide }),
      );
      marker.position.set(opening.x * s, floorThickness + 0.08 * s, opening.z * s);
      root.add(marker);
      continue;
    }
    addOpeningPreview(root, opening, roomWidth, roomDepth, roomHeight, wall, floorThickness, materials);
  }

  if (resetCamera) {
    const center = new THREE.Vector3(roomWidth / 2, roomHeight * 0.32, roomDepth / 2);
    const radius = Math.max(roomWidth, roomDepth, roomHeight) * 1.45;
    controls.target.copy(center);
    camera.position.set(center.x + radius * 0.72, center.y + radius * 0.52, center.z + radius * 0.78);
    controls.update();
  }
}

function addWallPreview(parent, wallName, fixedAxis, span, roomHeight, wallThickness, material, openings) {
  const cuts = getPreviewWallSegments(wallName, span, roomHeight, wallThickness, openings);
  for (const seg of cuts) {
    if (wallName === "front" || wallName === "back") {
      addBoxMesh(
        parent,
        seg.start + seg.length / 2,
        seg.bottom + seg.height / 2,
        fixedAxis + wallThickness / 2,
        seg.length,
        seg.height,
        wallThickness,
        material,
      );
    } else {
      addBoxMesh(
        parent,
        fixedAxis + wallThickness / 2,
        seg.bottom + seg.height / 2,
        seg.start + seg.length / 2,
        wallThickness,
        seg.height,
        seg.length,
        material,
      );
    }
  }
}

function getPreviewWallSegments(wallName, span, roomHeight, scaleWall, openings) {
  const wallOpenings = (openings || [])
    .filter((opening) => opening.wall === wallName && opening.type !== "entrance")
    .map((opening) => {
      const start = (wallName === "front" || wallName === "back" ? opening.x : opening.z) * state.opts.scale;
      const length = opening.width * state.opts.scale;
      const isDoor = opening.type === "door";
      const openHeight = isDoor
        ? clamp(roomHeight * 0.78, Math.min(roomHeight, 1.95 * state.opts.scale), roomHeight)
        : clamp(roomHeight * 0.34, Math.min(roomHeight * 0.5, 0.9 * state.opts.scale), Math.min(roomHeight * 0.72, 1.2 * state.opts.scale));
      const bottom = isDoor ? 0 : clamp(roomHeight * 0.34, 0.75 * state.opts.scale, Math.max(0, roomHeight - openHeight - 0.2 * state.opts.scale));
      return {
        start: clamp(start, 0, span),
        end: clamp(start + length, 0, span),
        bottom,
        top: clamp(bottom + openHeight, 0, roomHeight),
      };
    })
    .filter((opening) => opening.end - opening.start > scaleWall * 0.25)
    .sort((a, b) => a.start - b.start);

  const cuts = [0, roomHeight];
  for (const opening of wallOpenings) cuts.push(opening.bottom, opening.top);
  const rows = [...new Set(cuts.map((value) => clamp(value, 0, roomHeight)).sort((a, b) => a - b))];
  const segments = [];

  for (let i = 0; i < rows.length - 1; i += 1) {
    const bottom = rows[i];
    const top = rows[i + 1];
    const height = top - bottom;
    if (height <= 1e-6) continue;
    const bandOpenings = wallOpenings.filter((opening) => opening.bottom <= bottom && opening.top >= top);
    let cursor = 0;
    for (const opening of bandOpenings) {
      const start = clamp(opening.start, 0, span);
      const end = clamp(opening.end, 0, span);
      if (start > cursor) {
        segments.push({ start: cursor, length: start - cursor, bottom, height });
      }
      cursor = Math.max(cursor, end);
    }
    if (cursor < span) {
      segments.push({ start: cursor, length: span - cursor, bottom, height });
    }
  }
  return segments;
}

function addOpeningPreview(parent, opening, roomWidth, roomDepth, roomHeight, wallThickness, floorThickness, materials) {
  const scale = state.opts.scale;
  const isDoor = opening.type === "door";
  const material = isDoor ? materials.openingDoor : materials.openingWindow;
  const height = isDoor
    ? clamp(roomHeight * 0.78, Math.min(roomHeight, 1.95 * scale), roomHeight)
    : clamp(roomHeight * 0.34, Math.min(roomHeight * 0.5, 0.9 * scale), Math.min(roomHeight * 0.72, 1.2 * scale));
  const bottom = isDoor ? floorThickness + 0.01 * scale : floorThickness + clamp(roomHeight * 0.34, 0.75 * scale, Math.max(0, roomHeight - height - 0.2 * scale));
  if (opening.wall === "front" || opening.wall === "back") {
    const z = opening.wall === "front" ? wallThickness * 0.5 : roomDepth - wallThickness * 0.5;
    addBoxMesh(parent, (opening.x + opening.width / 2) * scale, bottom + height / 2, z, opening.width * scale, height, wallThickness * 0.12, material);
  } else if (opening.wall === "left" || opening.wall === "right") {
    const x = opening.wall === "left" ? wallThickness * 0.5 : roomWidth - wallThickness * 0.5;
    addBoxMesh(parent, x, bottom + height / 2, (opening.z + opening.width / 2) * scale, wallThickness * 0.12, height, opening.width * scale, material);
  }
}

function addFurniturePreview(parent, object, isSelected, floorThickness, scale) {
  const color = rgbToHex(object.color || [180, 180, 180]);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04,
    emissive: isSelected ? 0x22160d : 0x000000,
    emissiveIntensity: isSelected ? 0.3 : 0,
    side: THREE.DoubleSide,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: brightenColor(color, isSelected ? 0.14 : 0.08),
    roughness: 0.7,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const x = object.x * scale;
  const z = object.z * scale;
  const w = object.width * scale;
  const d = object.depth * scale;
  const h = Math.max(object.height * scale, 0.18 * scale);
  const centerX = x + w / 2;
  const centerZ = z + d / 2;
  const y = floorThickness;
  const label = normalizeLabel(object.label);
  const group = new THREE.Group();
  group.position.set(centerX, 0, centerZ);
  group.rotation.y = object.rotation || 0;
  parent.add(group);

  if (label === "bed") {
    addBoxMesh(group, 0, y + h * 0.2, 0, w, h * 0.4, d, material);
    addBoxMesh(group, 0, y + h * 0.48, -d * 0.03, w * 0.92, h * 0.34, d * 0.9, accentMaterial);
    addBoxMesh(group, 0, y + h * 0.56, d / 2 - d * 0.04, w, h * 0.52, d * 0.08, accentMaterial);
    return;
  }

  if (label === "couch") {
    addBoxMesh(group, 0, y + h * 0.22, 0, w, h * 0.44, d, material);
    addBoxMesh(group, 0, y + h * 0.63, d / 2 - d * 0.08, w, h * 0.36, d * 0.16, accentMaterial);
    addBoxMesh(group, -w * 0.43, y + h * 0.34, 0, w * 0.14, h * 0.4, d, accentMaterial);
    addBoxMesh(group, w * 0.43, y + h * 0.34, 0, w * 0.14, h * 0.4, d, accentMaterial);
    return;
  }

  if (label.includes("table")) {
    const legW = Math.min(w * 0.14, 0.1 * scale);
    const legD = Math.min(d * 0.14, 0.1 * scale);
    const topH = Math.max(h * 0.14, 0.05 * scale);
    const legH = Math.max(h - topH, 0.24 * scale);
    addBoxMesh(group, 0, y + legH + topH / 2, 0, w, topH, d, accentMaterial);
    addBoxMesh(group, -w / 2 + legW / 2, y + legH / 2, -d / 2 + legD / 2, legW, legH, legD, material);
    addBoxMesh(group, w / 2 - legW / 2, y + legH / 2, -d / 2 + legD / 2, legW, legH, legD, material);
    addBoxMesh(group, -w / 2 + legW / 2, y + legH / 2, d / 2 - legD / 2, legW, legH, legD, material);
    addBoxMesh(group, w / 2 - legW / 2, y + legH / 2, d / 2 - legD / 2, legW, legH, legD, material);
    return;
  }

  if (label === "chair") {
    addBoxMesh(group, 0, y + h * 0.48, 0, w * 0.86, h * 0.12, d * 0.86, accentMaterial);
    addBoxMesh(group, 0, y + h * 0.72, d * 0.37, w * 0.86, h * 0.38, d * 0.14, material);
    const legW = Math.min(w * 0.16, 0.08 * scale);
    const legD = Math.min(d * 0.16, 0.08 * scale);
    addBoxMesh(group, -w / 2 + legW / 2, y + h * 0.24, -d / 2 + legD / 2, legW, h * 0.48, legD, material);
    addBoxMesh(group, w / 2 - legW / 2, y + h * 0.24, -d / 2 + legD / 2, legW, h * 0.48, legD, material);
    addBoxMesh(group, -w / 2 + legW / 2, y + h * 0.24, d / 2 - legD / 2, legW, h * 0.48, legD, material);
    addBoxMesh(group, w / 2 - legW / 2, y + h * 0.24, d / 2 - legD / 2, legW, h * 0.48, legD, material);
    return;
  }

  addBoxMesh(group, 0, y + h / 2, 0, w, h, d, material);
}

function addBoxMesh(parent, x, y, z, width, height, depth, material) {
  if (width <= 1e-6 || height <= 1e-6 || depth <= 1e-6) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function renderThreePreview() {
  threePreview.controls.update();
  threePreview.renderer.render(threePreview.scene, threePreview.camera);
  updateThreeCompass();
}

function updateThreeCompass() {
  if (!els.compass3d || !threePreview?.camera || !threePreview?.controls) return;
  const offset = new THREE.Vector3().subVectors(threePreview.camera.position, threePreview.controls.target);
  offset.y = 0;
  if (offset.lengthSq() < 1e-6) return;
  offset.normalize();
  const yaw = Math.atan2(offset.x, offset.z);
  // Match the preview's mirrored X axis so the 3D compass tracks the 2D plan handedness.
  els.compass3d.style.setProperty("--compass-rot", `${yaw}rad`);
}

function renderPreviewFallback(message = "Build the 2D plan first, then extrude it into 3D") {
  const canvas = els.modelCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, "#f8fafe");
  grad.addColorStop(1, "#eae5dc");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(58,47,38,0.6)";
  ctx.font = "600 28px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("3D Room Preview", cw / 2, ch / 2 - 10);
  ctx.font = "400 18px 'Space Grotesk', sans-serif";
  ctx.fillText(message, cw / 2, ch / 2 + 20);
}

function renderMeshPreviewFallback() {
  const canvas = els.modelCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, "#f8fafe");
  grad.addColorStop(1, "#eae5dc");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  if (!state.mesh || !state.roomModel) {
    renderPreviewFallback();
    return;
  }

  const { vertices, normals, colors, triCount } = state.mesh;
  const room = state.roomModel;
  const s = state.opts.scale;
  const ox = (room.width * s) / 2;
  const oy = (room.height * s) / 2;
  const oz = (room.depth * s) / 2;
  const maxDim = Math.max(room.width, room.depth, room.height) * s;
  const scale = Math.min(cw, ch) * 0.55 / maxDim;
  const rotX = -0.45;
  const rotZ = 0.6;
  const cosRx = Math.cos(rotX);
  const sinRx = Math.sin(rotX);
  const cosRz = Math.cos(rotZ);
  const sinRz = Math.sin(rotZ);

  function project(px, py, pz) {
    const x = px - ox;
    const y = py - oy;
    const z = pz - oz;
    const x2 = x * cosRz - z * sinRz;
    const z2 = x * sinRz + z * cosRz;
    const y2 = y * cosRx - z2 * sinRx;
    const z3 = y * sinRx + z2 * cosRx;
    return { sx: cw / 2 + x2 * scale, sy: ch / 2 - y2 * scale, depth: z3 };
  }

  const faces = [];
  for (let i = 0; i < triCount; i += 1) {
    const vi = i * 9;
    const p0 = project(vertices[vi], vertices[vi + 1], vertices[vi + 2]);
    const p1 = project(vertices[vi + 3], vertices[vi + 4], vertices[vi + 5]);
    const p2 = project(vertices[vi + 6], vertices[vi + 7], vertices[vi + 8]);
    const cross = (p1.sx - p0.sx) * (p2.sy - p0.sy) - (p1.sy - p0.sy) * (p2.sx - p0.sx);
    if (cross <= 0) continue;

    const ni = i * 3;
    const nx = normals[ni];
    const ny = normals[ni + 1];
    const nz = normals[ni + 2];
    const nx2 = nx * cosRz - nz * sinRz;
    const nz2 = nx * sinRz + nz * cosRz;
    const ny2 = ny * cosRx - nz2 * sinRx;
    const nz3 = ny * sinRx + nz2 * cosRx;
    const light = 0.7 + 0.3 * Math.max(0, nx2 * 0.4 + ny2 * 0.5 + nz3 * 0.3);

    const ci = i * 3;
    faces.push({
      p0,
      p1,
      p2,
      depth: (p0.depth + p1.depth + p2.depth) / 3,
      light,
      r: colors[ci],
      g: colors[ci + 1],
      b: colors[ci + 2],
    });
  }

  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    const r = Math.min(255, Math.round(face.r * face.light));
    const g = Math.min(255, Math.round(face.g * face.light));
    const b = Math.min(255, Math.round(face.b * face.light));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(face.p0.sx, face.p0.sy);
    ctx.lineTo(face.p1.sx, face.p1.sy);
    ctx.lineTo(face.p2.sx, face.p2.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function rgbToHex(rgb) {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

function brightenColor(hex, amount) {
  const color = new THREE.Color(hex);
  color.lerp(new THREE.Color(0xffffff), amount);
  return color.getHex();
}

function exportSTL() {
  if (!state.mesh) return;
  const { vertices, normals, colors, triCount } = state.mesh;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  const header = "COLOR=rgba,MATERIAL=rgba";
  for (let i = 0; i < 80; i += 1) view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  view.setUint32(80, triCount, true);
  let offset = 84;
  for (let i = 0; i < triCount; i += 1) {
    const ni = i * 3;
    view.setFloat32(offset, normals[ni], true);
    view.setFloat32(offset + 4, normals[ni + 1], true);
    view.setFloat32(offset + 8, normals[ni + 2], true);
    offset += 12;
    const vi = i * 9;
    for (let v = 0; v < 9; v += 1) {
      view.setFloat32(offset, vertices[vi + v], true);
      offset += 4;
    }
    const ci = i * 3;
    const r5 = (colors[ci] >> 3) & 0x1f;
    const g5 = (colors[ci + 1] >> 3) & 0x1f;
    const b5 = (colors[ci + 2] >> 3) & 0x1f;
    view.setUint16(offset, 0x8000 | (r5 << 10) | (g5 << 5) | b5, true);
    offset += 2;
  }
  dl(baseName() + ".stl", new Blob([buffer], { type: "application/octet-stream" }));
}

function exportOBJ() {
  if (!state.mesh) return;
  const { vertices, triCount } = state.mesh;
  const lines = ["# Qidar room OBJ"];
  for (let i = 0; i < triCount; i += 1) {
    const vi = i * 9;
    lines.push(`v ${vertices[vi].toFixed(4)} ${vertices[vi + 1].toFixed(4)} ${vertices[vi + 2].toFixed(4)}`);
    lines.push(`v ${vertices[vi + 3].toFixed(4)} ${vertices[vi + 4].toFixed(4)} ${vertices[vi + 5].toFixed(4)}`);
    lines.push(`v ${vertices[vi + 6].toFixed(4)} ${vertices[vi + 7].toFixed(4)} ${vertices[vi + 8].toFixed(4)}`);
  }
  for (let i = 0; i < triCount; i += 1) {
    const base = i * 3 + 1;
    lines.push(`f ${base} ${base + 1} ${base + 2}`);
  }
  dl(baseName() + ".obj", new Blob([lines.join("\n")], { type: "text/plain" }));
}

function baseName() {
  return state.fileName.replace(/\.[^.]+$/, "") || "room";
}

function dl(name, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function extractImagePayload() {
  const image = els.image;
  if (!image.complete || !image.naturalWidth) {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not decode image"));
      if (image.complete && image.naturalWidth) resolve();
    });
  }
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const scale = Math.min(1, 160 / Math.max(iw, ih));
  const w = Math.max(24, Math.round(iw * scale));
  const h = Math.max(24, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const rowBrightness = new Array(h).fill(0);
  const columnEnergy = new Array(w).fill(0);
  let overallBrightness = 0;
  const brightnessGrid = [];

  for (let y = 0; y < h; y += 1) {
    const row = [];
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      row.push(Math.round(brightness));
      rowBrightness[y] += brightness;
      overallBrightness += brightness;
      if (x > 0 && y >= Math.floor(h * 0.35)) {
        const pi = i - 4;
        const prev = data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114;
        columnEnergy[x] += Math.abs(brightness - prev);
      }
    }
    brightnessGrid.push(row);
  }

  overallBrightness /= w * h;
  for (let y = 0; y < h; y += 1) rowBrightness[y] /= w;
  return { imageWidth: w, imageHeight: h, rowBrightness, columnEnergy, overallBrightness, brightnessGrid };
}

async function createPreviewUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url);
    return url;
  } catch {
    URL.revokeObjectURL(url);
  }
  if (!window.heic2any) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error("HEIC decoder failed"));
      document.head.appendChild(script);
    });
  }
  const blob = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return URL.createObjectURL(Array.isArray(blob) ? blob[0] : blob);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
