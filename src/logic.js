// Chidar/src/logic.js — Pure functions extracted from app.js for testability.
// No DOM, Three.js, Canvas, or global mutable state dependencies.

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAJOR_OBJECTS = {
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
  // Decor
  plant: { w: 0.4, h: 0.9, d: 0.4, color: [72, 140, 68], zone: "front" },
  rug: { w: 1.8, h: 0.02, d: 1.2, color: [178, 142, 110], zone: "center" },
  lamp: { w: 0.35, h: 1.4, d: 0.35, color: [210, 190, 140], zone: "front" },
  mirror: { w: 0.8, h: 1.2, d: 0.08, color: [180, 200, 215], zone: "back" },
  "side table": { w: 0.5, h: 0.55, d: 0.5, color: [165, 130, 95], zone: "center" },
  ottoman: { w: 0.6, h: 0.4, d: 0.6, color: [148, 118, 96], zone: "center" },
};

export const ELEMENT_MAP = {
  wood: ["bed", "couch", "chair", "dresser", "nightstand", "wardrobe", "desk",
    "bookshelf", "bathroom cabinet", "patio chair", "lounge chair", "plant",
    "side table"],
  fire: ["oven", "grill", "lamp"],
  earth: ["dining table", "patio table", "kitchen island", "planter", "rug",
    "ottoman"],
  metal: ["tv stand", "refrigerator", "dishwasher"],
  water: ["sink", "bathtub", "shower", "toilet", "mirror"],
};

export const BAGUA_GRID = [
  ["knowledge", "career", "helpful people"],
  ["family", "health", "creativity"],
  ["wealth", "fame", "relationships"],
];

// ─── Utility ─────────────────────────────────────────────────────────────────

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeLabel(label) {
  return String(label || "").trim().toLowerCase();
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

export function getObjectFootprintBounds(object) {
  const turns = (((Math.round((object.rotation || 0) / (Math.PI / 2)) % 4) + 4) % 4);
  return turns % 2 === 1
    ? { width: object.depth, depth: object.width }
    : { width: object.width, depth: object.depth };
}

export function getObjectFootprintCenter(object) {
  const bounds = getObjectFootprintBounds(object);
  return {
    x: object.x + bounds.width / 2,
    z: object.z + bounds.depth / 2,
    boundsWidth: bounds.width,
    boundsDepth: bounds.depth,
  };
}


export function findObjectAtPlanPoint(point, plan) {
  for (let i = plan.objects.length - 1; i >= 0; i -= 1) {
    const object = plan.objects[i];
    const rot = object.rotation || 0;
    const { x: cx, z: cz } = getObjectFootprintCenter(object);
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

export function overlapsRect(a, b, padding = 0) {
  const aBounds = getObjectFootprintBounds(a);
  const bBounds = getObjectFootprintBounds(b);
  return !(
    a.x + aBounds.width + padding <= b.x ||
    b.x + bBounds.width + padding <= a.x ||
    a.z + aBounds.depth + padding <= b.z ||
    b.z + bBounds.depth + padding <= a.z
  );
}

export function deriveDepthZone(object, plan) {
  const centerZ = getObjectFootprintCenter(object).z;
  if (centerZ < plan.depth * 0.33) return "front";
  if (centerZ > plan.depth * 0.66) return "back";
  return "center";
}

export function deriveSideZone(object, plan) {
  const centerX = getObjectFootprintCenter(object).x;
  if (centerX < plan.width * 0.34) return "left";
  if (centerX > plan.width * 0.66) return "right";
  return "center";
}

export function objCenter(o) {
  return { x: o.x + o.width / 2, z: o.z + o.depth / 2 };
}

export function doorPoint(door, plan) {
  if (!door) return null;
  if (door.wall === "front") return { x: door.x + (door.width || 0) / 2, z: 0 };
  if (door.wall === "back") return { x: door.x + (door.width || 0) / 2, z: plan.depth };
  if (door.wall === "left") return { x: 0, z: door.z + (door.width || 0) / 2 };
  return { x: plan.width, z: door.z + (door.width || 0) / 2 };
}

export function distToPoint(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function isAgainstWall(obj, plan, wall, threshold) {
  const t = threshold || plan.wallThickness * 2.5;
  if (wall === "back") return obj.z + obj.depth >= plan.depth - t;
  if (wall === "front") return obj.z <= t;
  if (wall === "left") return obj.x <= t;
  if (wall === "right") return obj.x + obj.width >= plan.width - t;
  return false;
}

export function isAgainstAnyWall(obj, plan, threshold) {
  return ["front", "back", "left", "right"].some((w) => isAgainstWall(obj, plan, w, threshold));
}

// ─── Floor plan functions ────────────────────────────────────────────────────

export function snapObjectToZone(footprint, layout, wallThickness) {
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

export function resolveObjectCollisions(objects, layout, wallThickness) {
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
          const bounds = getObjectFootprintBounds(candidate);
          const tx = clamp(object.x + dx * sx, wallThickness, layout.width - wallThickness - bounds.width);
          const tz = clamp(object.z + dz * sz, wallThickness, layout.depth - wallThickness - bounds.depth);
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

// ─── Opening functions ───────────────────────────────────────────────────────

/**
 * Infer openings for a room layout.
 * @param {object} roomModel - Room model with width/depth
 * @param {object} analysis - Analysis data with dominantSide
 * @param {string} anchorWall - The anchor wall ("left", "right", or "back")
 * @param {object} manualOpenings - Manual openings { door: [], window: [], entrance: [] }
 * @param {boolean} suppressInferred - Whether to suppress inferred openings
 */
export function inferOpenings(roomModel, analysis, anchorWall, manualOpenings, suppressInferred = false) {
  const width = roomModel.width;
  const depth = roomModel.depth;
  if (suppressInferred) {
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

export function buildManualDoor(point, plan) {
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

export function buildManualWindow(point, plan) {
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

// ─── Layout model ────────────────────────────────────────────────────────────

/**
 * Build the layout model from room model and analysis.
 * @param {object} roomModel - Room model with width/depth/height
 * @param {object} analysis - Analysis data with dominantSide
 * @param {object} manualOpenings - Manual openings { door: [], window: [], entrance: [] }
 * @param {boolean} suppressInferred - Whether to suppress inferred openings
 */
export function buildLayoutModel(roomModel, analysis, manualOpenings, suppressInferred = false) {
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
    openings: inferOpenings(roomModel, analysis, anchorWall, manualOpenings, suppressInferred),
  };
}


// ─── Feng Shui functions ─────────────────────────────────────────────────────

export function objectElement(label) {
  const map = {
    bed: "wood", couch: "wood", chair: "wood", dresser: "wood", nightstand: "wood", wardrobe: "wood", desk: "wood", bookshelf: "wood", "tv stand": "metal",
    "dining table": "earth", "patio table": "earth", "kitchen island": "earth",
    refrigerator: "metal", dishwasher: "metal", oven: "fire", grill: "fire",
    sink: "water", bathtub: "water", shower: "water", toilet: "water",
    "bathroom cabinet": "wood", "patio chair": "wood", "lounge chair": "wood", planter: "earth",
    plant: "wood", rug: "earth", lamp: "fire", mirror: "water", "side table": "wood", ottoman: "earth",
  };
  return map[normalizeLabel(label)] || "earth";
}

export function baguaZone(obj, plan) {
  const c = objCenter(obj);
  const col = c.x < plan.width / 3 ? 0 : c.x < plan.width * 2 / 3 ? 1 : 2;
  const row = c.z < plan.depth / 3 ? 0 : c.z < plan.depth * 2 / 3 ? 1 : 2;
  return BAGUA_GRID[row][col];
}

export function entryCorridor(plan, dp) {
  if (!dp) return null;
  const cw = plan.width * 0.22;
  const cd = plan.depth * 0.55;
  if (dp.z <= 0.01) return { x: dp.x - cw / 2, z: 0, width: cw, depth: cd };
  if (dp.z >= plan.depth - 0.01) return { x: dp.x - cw / 2, z: plan.depth - cd, width: cw, depth: cd };
  if (dp.x <= 0.01) return { x: 0, z: dp.z - cw / 2, width: cd, depth: cw };
  return { x: plan.width - cd, z: dp.z - cw / 2, width: cd, depth: cw };
}

function baguaZoneAt(col, row) {
  return BAGUA_GRID[row]?.[col] || "health";
}

export function buildFengShuiModel(plan, layout, analysis) {
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
  const baguaGridResult = [];
  for (let row = 0; row < 3; row++) {
    const r = [];
    for (let col = 0; col < 3; col++) {
      const name = baguaZoneAt(col, row);
      r.push({ name, count: baguaCounts[name] || 0 });
    }
    baguaGridResult.push(r);
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
    const blocked = plan.objects.some((o) => overlapsRect(o, corridor, 0.02));
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

  return { score, verdict, findings, recommendations, elements, baguaGrid: baguaGridResult };
}


// ─── Mesh functions ──────────────────────────────────────────────────────────

export function cleanMesh(mesh) {
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

export function buildMeshFromFloorPlan(plan, opts, colors) {
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
    const cx = bnd.reduce((sum, p) => sum + p.x, 0) / bnd.length * s;
    const cz = bnd.reduce((sum, p) => sum + p.z, 0) / bnd.length * s;
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