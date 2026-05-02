import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 4173


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def average(values):
    return sum(values) / len(values) if values else 0


def group_occupied_columns(occupied_columns, image_width, horizon_row, image_height):
    groups = []
    start = -1

    for index in range(len(occupied_columns) + 1):
        occupied = occupied_columns[index] if index < len(occupied_columns) else False
        if occupied and start == -1:
            start = index
            continue
        if not occupied and start != -1:
            groups.append({"start": start, "end": index - 1})
            start = -1

    minimum_span = max(3, round(image_width * 0.06))
    zones = []
    for group_index, group in enumerate(groups):
        if group["end"] - group["start"] < minimum_span:
            continue
        if len(zones) >= 3:
            break
        zones.append(
            {
                "name": f"occupied zone {group_index + 1}",
                "x": clamp((group["start"] / image_width) * 100, 0, 100),
                "y": clamp((horizon_row / image_height) * 100, 0, 100),
                "width": clamp(((group["end"] - group["start"] + 1) / image_width) * 100, 4, 100),
                "height": clamp(((image_height - horizon_row) / image_height) * 100, 8, 100),
            }
        )
    return zones


def find_horizon_row(row_brightness, row_gradients):
    start = max(4, int(len(row_brightness) * 0.28))
    end = min(len(row_brightness) - 4, int(len(row_brightness) * 0.78))
    best_index = int(len(row_brightness) * 0.58)
    best_score = float("-inf")

    for row in range(start, end + 1):
        contrast = row_gradients[row] if row < len(row_gradients) else 0
        below = average(row_brightness[row : min(len(row_brightness), row + 6)])
        above = average(row_brightness[max(0, row - 6) : row])
        lower_weight = row / len(row_brightness)
        score = contrast + max(0, below - above) * 0.35 + lower_weight * 8
        if score > best_score:
            best_score = score
            best_index = row

    return best_index


def describe_lighting(overall_brightness):
    if overall_brightness >= 190:
        return "bright daylight"
    if overall_brightness >= 145:
        return "balanced ambient light"
    if overall_brightness >= 105:
        return "soft interior light"
    return "dim interior light"


def describe_room_type(image_width, image_height, avoid_zones):
    aspect_ratio = image_width / image_height if image_height else 1
    if aspect_ratio >= 1.45:
        return "wide living area"
    if len(avoid_zones) >= 2:
        return "furnished bedroom or lounge"
    if aspect_ratio <= 0.9:
        return "compact bedroom"
    return "multi-purpose interior room"


def describe_camera_view(image_width, image_height, horizon_row):
    aspect_ratio = image_width / image_height if image_height else 1
    horizon_percent = (horizon_row / image_height) * 100 if image_height else 58

    if aspect_ratio >= 1.4 and horizon_percent >= 50:
        return "eye-level wide shot"
    if aspect_ratio <= 0.9:
        return "upright phone capture"
    if horizon_percent < 45:
        return "slightly elevated angle"
    return "straight-on interior view"


def build_model_guidance(avoid_zones, dominant_side, horizon_percent):
    guidance = [
        "The model assumes a single dominant horizontal floor plane and a visible back wall.",
        "Calibrate against a known object height to improve room scale before export.",
    ]

    if avoid_zones:
        guidance.append("Occupied regions were detected and are excluded from the clean floor area estimate.")
    else:
        guidance.append("The floor area appears mostly open, so the room shell estimate is less constrained by obstructions.")

    if dominant_side == "left":
        guidance.append("The left side carries more visual mass, which can skew width estimation on that side.")
    elif dominant_side == "right":
        guidance.append("The right side carries more visual mass, which can skew width estimation on that side.")

    if horizon_percent >= 60:
        guidance.append("Visible floor depth is shallow, so depth estimates are less reliable toward the foreground.")
    else:
        guidance.append("Visible floor depth is moderate, which gives the depth estimate more support.")

    return guidance


def estimate_room_width_meters(floor_polygon, calibration, display_width):
    if len(floor_polygon) < 2:
        return 4.8
    width_percent = abs(floor_polygon[1]["x"] - floor_polygon[0]["x"])
    if not calibration:
        return clamp(width_percent * 0.07, 3.2, 7.5)
    pixel_width = (width_percent / 100) * max(display_width, 1)
    return clamp(pixel_width / calibration["pixelsPerMeter"], 2.8, 10)


def estimate_room_depth_meters(floor_polygon, calibration, display_height):
    if len(floor_polygon) < 4:
        return 5.4
    height_percent = abs(floor_polygon[3]["y"] - floor_polygon[0]["y"])
    if not calibration:
        return clamp(height_percent * 0.09, 3.5, 9)
    pixel_depth = (height_percent / 100) * max(display_height, 1)
    return clamp((pixel_depth / calibration["pixelsPerMeter"]) * 1.8, 3, 12)


def estimate_room_height_meters(calibration):
    if calibration and "door" in calibration["label"].lower():
        return clamp(calibration["realHeightMeters"] * 1.18, 2.3, 3.6)
    if calibration:
        return clamp(calibration["realHeightMeters"] * 1.45, 2.2, 4)
    return 2.7


def build_room_model(analysis, calibration, display_width, display_height, placed_furniture=None):
    room_width = estimate_room_width_meters(analysis["floorPolygon"], calibration, display_width)
    room_depth = estimate_room_depth_meters(analysis["floorPolygon"], calibration, display_height)
    room_height = estimate_room_height_meters(calibration)
    return {
        "width": room_width,
        "depth": room_depth,
        "height": room_height,
        "floorArea": room_width * room_depth,
        "objects": placed_furniture or [],
        "walls": [
            {"name": "left wall", "width": room_depth, "height": room_height},
            {"name": "back wall", "width": room_width, "height": room_height},
            {"name": "right wall", "width": room_depth, "height": room_height},
        ],
    }


def analyze_room(payload):
    image_width = payload["imageWidth"]
    image_height = payload["imageHeight"]
    row_brightness = payload["rowBrightness"]
    column_energy = payload["columnEnergy"]
    overall_brightness = payload["overallBrightness"]
    calibration = payload.get("calibration")

    row_gradients = [0]
    row_gradients.extend(abs(row_brightness[index] - row_brightness[index - 1]) for index in range(1, len(row_brightness)))

    horizon_row = find_horizon_row(row_brightness, row_gradients)
    horizon_percent = (horizon_row / image_height) * 100 if image_height else 58
    halfway = max(1, image_width // 2)
    left_energy = average(column_energy[:halfway])
    right_energy = average(column_energy[halfway:])
    dominant_side = "center"
    if left_energy > right_energy * 1.1:
        dominant_side = "left"
    elif right_energy > left_energy * 1.1:
        dominant_side = "right"

    energy_average = average(column_energy)
    occupied_columns = []
    for index, value in enumerate(column_energy):
        lower_band = index > image_width * 0.08 and index < image_width * 0.92
        occupied_columns.append(lower_band and value > energy_average * 1.55)

    avoid_zones = group_occupied_columns(occupied_columns, image_width, horizon_row, image_height)
    left_inset = 18 if dominant_side == "left" else 12
    right_inset = 18 if dominant_side == "right" else 12
    floor_polygon = [
        {"x": left_inset, "y": clamp(horizon_percent + 2, 20, 92)},
        {"x": 100 - right_inset, "y": clamp(horizon_percent + 2, 20, 92)},
        {"x": 96, "y": 100},
        {"x": 4, "y": 100},
    ]
    wall_top = 4
    wall_height = clamp(horizon_percent - wall_top, 12, 70)
    wall_zones = [
        {"name": "left wall", "x": 0, "y": wall_top, "width": 24, "height": wall_height},
        {"name": "back wall", "x": 24, "y": wall_top, "width": 52, "height": wall_height},
        {"name": "right wall", "x": 76, "y": wall_top, "width": 24, "height": wall_height},
    ]

    analysis = {
        "summary": (
            f"Detected a {describe_room_type(image_width, image_height, avoid_zones)} with "
            f"{len(avoid_zones)} occupied floor zone{'s' if len(avoid_zones) != 1 else ''} and a usable floor plane."
            if avoid_zones
            else f"Detected a {describe_room_type(image_width, image_height, avoid_zones)} with a mostly open floor plane and a visible back wall."
        ),
        "roomType": describe_room_type(image_width, image_height, avoid_zones),
        "cameraView": describe_camera_view(image_width, image_height, horizon_row),
        "floorPolygon": floor_polygon,
        "wallZones": wall_zones,
        "avoidZones": avoid_zones,
        "placementGuidance": build_model_guidance(avoid_zones, dominant_side, horizon_percent),
        "lighting": describe_lighting(overall_brightness),
        "model": "python-room-model-v1",
        "dominantSide": dominant_side,
        "horizonPercent": horizon_percent,
    }
    room_model = build_room_model(analysis, calibration, image_width, image_height)
    return {"analysis": analysis, "roomModel": room_model}


class ChidarHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/health":
            self.send_json({"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/model-room":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8"))
            response = analyze_room(payload)
        except Exception as error:
            self.send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
            return

        self.send_json(response)

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), ChidarHandler)
    print(f"Serving Chidar at http://{HOST}:{PORT}")
    server.serve_forever()
