# Requirements Document

## Introduction

Qidar is a browser-based room layout analysis and Feng Shui scoring tool. A user uploads a room photograph, and the system analyzes the image to detect room geometry, places furniture on a 2D floor plan, scores the layout against Feng Shui principles, renders a 3D preview, and exports the model as STL or OBJ. The application uses a vanilla JavaScript frontend with Three.js for 3D rendering, Canvas 2D for the floor plan, and a Python backend for room analysis. Deployment targets Vercel serverless functions for the API and static hosting for the frontend.

## Glossary

- **Qidar_App**: The complete browser-based application including frontend UI, image processing, floor plan generation, Feng Shui scoring, 3D preview, and export functionality.
- **Room_Analyzer**: The Python backend service that receives extracted image data and returns room geometry analysis including horizon line, occupied zones, wall zones, floor polygon, lighting conditions, room type, camera view angle, and estimated room dimensions.
- **Image_Processor**: The client-side module that extracts a brightness grid, row brightness, column energy, and overall brightness from an uploaded image and sends the payload to the Room_Analyzer.
- **Object_Detector**: The client-side module that uses the TensorFlow.js COCO-SSD model to detect furniture objects in the uploaded image.
- **Floor_Plan_Builder**: The client-side module that constructs a 2D floor plan with walls, furniture footprints, openings (doors and windows), and a boundary polygon from room model data and detected objects.
- **Feng_Shui_Scorer**: The client-side module that evaluates the floor plan layout against Feng Shui principles and produces a score, findings, and recommendations.
- **Three_D_Renderer**: The client-side module that renders the room model in Three.js with OrbitControls, colored walls, furniture meshes, and door/window openings.
- **Mesh_Exporter**: The client-side module that exports the generated 3D mesh as binary STL (with color) or OBJ format.
- **Layout_Model**: An intermediate data structure describing room dimensions, anchor wall, depth zone bands (front, center, back), side bands (left, center, right), and inferred or manual openings.
- **Brightness_Grid**: A 2D array of per-pixel brightness values extracted from a downscaled version of the uploaded image.
- **HEIC_Converter**: The client-side module that converts HEIC/HEIF images to JPEG using the heic2any library when the browser cannot decode the original format.
- **Calibration_Object**: An optional reference object with a known real-world height used to improve room dimension estimation accuracy.
- **Bagua_Map**: A 3×3 energy grid mapping wealth, health, relationships, career, creativity, knowledge, fame, family, and helpful people zones onto the floor plan.
- **Command_Position**: A Feng Shui principle where the primary furniture piece (bed or couch) is backed by a solid wall with a clear sightline to the room entrance.
- **Qi_Flow_Path**: The corridor of space extending from the main entrance into the room through which energy circulates.

## Requirements

### Requirement 1: Image Upload and Format Handling

**User Story:** As a user, I want to upload a room photo in common formats including HEIC, so that I can analyze any photo from my device.

#### Acceptance Criteria

1. WHEN a user selects a JPEG or PNG file, THE Qidar_App SHALL display the image in the preview area and enable the Analyze Layout button.
2. WHEN a user selects a HEIC or HEIF file that the browser cannot decode natively, THE HEIC_Converter SHALL convert the file to JPEG using the heic2any library and display the resulting image.
3. WHEN a user selects a replacement image, THE Qidar_App SHALL clear all previous analysis state, room model, floor plan, Feng Shui results, and mesh data before displaying the new image.
4. WHEN the user clicks the Reset button, THE Qidar_App SHALL clear the uploaded image, all analysis state, and return the interface to its initial idle state.

### Requirement 2: Client-Side Image Data Extraction

**User Story:** As a user, I want the app to extract meaningful data from my photo automatically, so that the backend can analyze the room without receiving the full image.

#### Acceptance Criteria

1. WHEN the Analyze Layout button is clicked, THE Image_Processor SHALL downscale the image to a maximum dimension of 160 pixels while preserving the aspect ratio.
2. THE Image_Processor SHALL compute a per-row brightness array, a per-column energy array, an overall brightness value, and a full Brightness_Grid from the downscaled image.
3. THE Image_Processor SHALL send the extracted payload (imageWidth, imageHeight, rowBrightness, columnEnergy, overallBrightness, brightnessGrid) to the Room_Analyzer via a POST request to the `/api/model-room` endpoint.

### Requirement 3: Room Analysis (Python Backend)

**User Story:** As a user, I want the system to analyze my room photo data and estimate room geometry, so that a floor plan and 3D model can be generated.

#### Acceptance Criteria

1. WHEN the Room_Analyzer receives a valid payload, THE Room_Analyzer SHALL detect the horizon line by scoring rows based on brightness gradient contrast, below-vs-above brightness difference, and vertical position weighting.
2. THE Room_Analyzer SHALL classify occupied columns using column energy values exceeding 1.15 times the average energy, and group consecutive occupied columns into occupied zones with a minimum span of 3% of image width, up to a maximum of 8 zones.
3. WHEN a Brightness_Grid is provided, THE Room_Analyzer SHALL perform edge-based object detection by computing horizontal and vertical gradients, thresholding at 1.3 times the average edge magnitude, and grouping connected components into bounding boxes with a minimum size of 6% of the grid dimensions.
4. THE Room_Analyzer SHALL determine the dominant side (left, center, or right) by comparing the average column energy of the left half to the right half, with a 10% threshold for asymmetry.
5. THE Room_Analyzer SHALL construct a floor polygon with four vertices whose horizontal insets depend on the dominant side (18% inset on the heavy side, 12% on the opposite side).
6. THE Room_Analyzer SHALL construct three wall zones (left wall, back wall, right wall) positioned above the horizon line.
7. THE Room_Analyzer SHALL describe the lighting condition as one of "bright daylight" (brightness >= 190), "balanced ambient light" (>= 145), "soft interior light" (>= 105), or "dim interior light" (< 105).
8. THE Room_Analyzer SHALL classify the room type based on aspect ratio and occupied zone count as one of "wide living area", "furnished bedroom or lounge", "compact bedroom", or "multi-purpose interior room".
9. THE Room_Analyzer SHALL describe the camera view angle based on aspect ratio and horizon position as one of "eye-level wide shot", "upright phone capture", "slightly elevated angle", or "straight-on interior view".
10. THE Room_Analyzer SHALL estimate room width in meters from the floor polygon width percentage, clamped between 3.2 and 7.5 meters without calibration, or between 2.8 and 10 meters with a Calibration_Object.
11. THE Room_Analyzer SHALL estimate room depth in meters from the floor polygon height percentage, clamped between 3.5 and 9 meters without calibration, or between 3 and 12 meters with a Calibration_Object.
12. THE Room_Analyzer SHALL estimate room height as 2.7 meters without calibration, or derived from the Calibration_Object real height (multiplied by 1.18 for doors, 1.45 otherwise) clamped between 2.2 and 4 meters.
13. THE Room_Analyzer SHALL return a JSON response containing the analysis object (summary, roomType, cameraView, floorPolygon, wallZones, avoidZones, placementGuidance, lighting, dominantSide, horizonPercent) and a roomModel object (width, depth, height, floorArea, walls).
14. IF the Room_Analyzer receives an invalid or malformed payload, THEN THE Room_Analyzer SHALL return an HTTP 400 response with a JSON body containing an error message.

### Requirement 4: Client-Side Object Detection

**User Story:** As a user, I want the system to detect furniture in my photo, so that the floor plan includes real objects from the room.

#### Acceptance Criteria

1. WHEN the analysis pipeline reaches the mesh-building step, THE Object_Detector SHALL load TensorFlow.js and the COCO-SSD model dynamically if not already loaded.
2. THE Object_Detector SHALL run inference on the uploaded image with a maximum of 20 detections and a minimum confidence score of 0.3.
3. IF object detection fails, THEN THE Qidar_App SHALL log a warning and continue the pipeline without detected objects.

### Requirement 5: 2D Floor Plan Generation

**User Story:** As a user, I want to see a 2D floor plan of my room with furniture placed on it, so that I can understand and modify the layout.

#### Acceptance Criteria

1. THE Floor_Plan_Builder SHALL create a floor plan with room width, depth, height, wall thickness, a boundary polygon, furniture objects, and openings derived from the room model and layout model.
2. WHEN COCO-SSD detections are available, THE Floor_Plan_Builder SHALL map each detected object with a matching preset (from the ~30 predefined furniture types) onto the floor plan using perspective projection based on the floor polygon and horizon line.
3. WHEN avoid zones from the Room_Analyzer are available, THE Floor_Plan_Builder SHALL map non-overlapping avoid zones onto the floor plan as "major furniture" footprints.
4. THE Floor_Plan_Builder SHALL snap furniture objects to their assigned depth zone (front, center, back) and side zone (left, center, right) within the Layout_Model bands.
5. THE Floor_Plan_Builder SHALL resolve overlapping furniture by iteratively shifting colliding objects in 0.25-meter steps across all four diagonal directions until no overlap exists or the search space is exhausted.
6. WHEN fewer than 2 furniture objects are placed from detection, THE Floor_Plan_Builder SHALL add fallback furniture appropriate to the detected room type (bed and chair for bedrooms, couch and table for living areas).
7. THE Floor_Plan_Builder SHALL limit the number of detected furniture objects to 8 per floor plan.

### Requirement 6: Opening Inference and Manual Marking

**User Story:** As a user, I want doors and windows to appear on my floor plan automatically, and I want to override them manually, so that the plan reflects the real room.

#### Acceptance Criteria

1. THE Layout_Model SHALL infer a default door on the wall opposite the anchor wall and a default window on the back wall, with an additional side window on the wall opposite the dominant side.
2. WHEN the user activates a marker mode (door, window, or entrance) and clicks on the 2D floor plan, THE Qidar_App SHALL place a manual opening on the nearest wall at the clicked position.
3. WHEN manual doors are placed, THE Layout_Model SHALL use manual doors instead of inferred doors. WHEN manual windows are placed, THE Layout_Model SHALL use manual windows instead of inferred windows.
4. WHEN the user clicks on an existing manual opening in the floor plan, THE Qidar_App SHALL remove that opening.
5. WHEN the user clicks the Clear Marks button, THE Qidar_App SHALL remove all manual openings and suppress inferred openings until new manual openings are placed or a new analysis is run.

### Requirement 7: Interactive Furniture Manipulation

**User Story:** As a user, I want to drag, resize, rotate, add, and remove furniture on the 2D floor plan, so that I can customize the layout.

#### Acceptance Criteria

1. WHEN the user clicks on a furniture object in the 2D floor plan, THE Qidar_App SHALL select that object and display resize handles at its four corners.
2. WHEN the user drags a selected furniture object, THE Qidar_App SHALL move the object within the room boundaries (constrained by wall thickness) and update its depth zone and side zone assignments.
3. WHEN the user drags a corner resize handle, THE Qidar_App SHALL resize the furniture object with a minimum dimension of 0.2 meters, constrained within the room boundaries.
4. WHEN the user clicks the Rotate 90° button with a furniture object selected, THE Qidar_App SHALL rotate the object by 90 degrees and re-center it within the room boundaries.
5. WHEN the user clicks a furniture button in the toolbox, THE Qidar_App SHALL add a new furniture object of that type to the floor plan, placed in its default zone, and resolve any collisions with existing objects.
6. WHEN the user clicks the Remove Selected button, THE Qidar_App SHALL remove the selected furniture object from the floor plan.
7. THE Qidar_App SHALL provide a categorized furniture toolbox with five categories (Bedroom, Bathroom, Outdoor, Kitchen, Decor) containing approximately 30 predefined furniture types, each with default dimensions, color, and preferred zone.

### Requirement 8: Floor Plan Navigation

**User Story:** As a user, I want to pan and zoom the 2D floor plan, so that I can inspect details of the layout.

#### Acceptance Criteria

1. WHEN the user scrolls the mouse wheel over the 2D floor plan canvas, THE Qidar_App SHALL zoom the plan view between 0.6x and 4x, centered on the cursor position.
2. WHEN the user clicks and drags on an empty area of the 2D floor plan canvas, THE Qidar_App SHALL pan the plan view by the drag offset.

### Requirement 9: Feng Shui Scoring

**User Story:** As a user, I want to see a Feng Shui score and recommendations for my room layout, so that I can improve the energy flow of my space.

#### Acceptance Criteria

1. THE Feng_Shui_Scorer SHALL evaluate the command position of the anchor furniture (bed or couch) by checking whether the furniture is backed by a wall, has a sightline to the door, and is not directly aligned with the doorway.
2. THE Feng_Shui_Scorer SHALL count the five elements (wood, fire, earth, metal, water) represented by furniture objects and report elemental diversity, missing elements with specific remediation suggestions, and dominant element warnings.
3. THE Feng_Shui_Scorer SHALL map each furniture object to a Bagua_Map zone (3×3 grid: knowledge, career, helpful people, family, health, creativity, wealth, fame, relationships) and evaluate whether the health/center zone is cluttered (floor coverage exceeding 12% of room area) and whether the wealth corner is activated.
4. THE Feng_Shui_Scorer SHALL evaluate qi flow by checking whether furniture blocks the entry corridor (a zone extending 22% of room width wide and 55% of room depth deep from the main entrance).
5. THE Feng_Shui_Scorer SHALL evaluate yin/yang balance by comparing the count of tall items (height exceeding 50% of room height) to low items (height at or below 30% of room height), with different expectations for bedrooms versus living spaces.
6. THE Feng_Shui_Scorer SHALL evaluate mirror placement, checking that mirrors do not directly face the bed and that mirrors face windows for positive energy.
7. THE Feng_Shui_Scorer SHALL evaluate the kitchen work triangle (stove, sink, refrigerator spacing) when all three objects are present.
8. THE Feng_Shui_Scorer SHALL evaluate bathroom rules, penalizing toilets that are too close to the entrance or positioned in the center of the space.
9. THE Feng_Shui_Scorer SHALL evaluate clutter by computing the furniture floor coverage ratio and penalizing layouts exceeding 45% coverage, and evaluate left-right symmetry by comparing furniture mass on each side.
10. THE Feng_Shui_Scorer SHALL evaluate lighting conditions, penalizing dim interior light and rewarding bright or natural lighting.
11. THE Feng_Shui_Scorer SHALL produce a final score clamped between 10 and 98, a verdict string (excellent harmony, good balance, workable, or needs significant adjustment), a list of findings with severity levels (good, warn, note), a list of actionable recommendations, element counts, and a Bagua grid.

### Requirement 10: 3D Room Preview

**User Story:** As a user, I want to see a live 3D preview of my room, so that I can visualize the layout from different angles.

#### Acceptance Criteria

1. THE Three_D_Renderer SHALL render the room using Three.js with a WebGL renderer, a perspective camera (42° FOV), hemisphere lighting, a directional sun light, and a directional fill light.
2. THE Three_D_Renderer SHALL display walls with colors sampled from the corresponding regions of the uploaded image (left wall, back wall, right wall, floor).
3. THE Three_D_Renderer SHALL render door openings as cutouts in the wall geometry with green-colored door panels, and window openings as cutouts with semi-transparent blue panels.
4. THE Three_D_Renderer SHALL render furniture objects as shaped 3D meshes with type-specific geometry (beds with headboard and mattress, couches with arms and back, tables with legs and top, chairs with seat and back, and generic boxes for other types).
5. THE Three_D_Renderer SHALL highlight the selected furniture object with an emissive glow effect.
6. WHEN the user interacts with the 3D canvas, THE Three_D_Renderer SHALL support orbit rotation, zoom, and damped controls via OrbitControls with a maximum polar angle preventing the camera from going below the floor.
7. WHEN the room model changes, THE Three_D_Renderer SHALL reset the camera position to frame the room at an appropriate distance.
8. THE Three_D_Renderer SHALL support both rectangular room boundaries and arbitrary polygon boundaries, rendering polygon floors using ExtrudeGeometry and polygon walls as oriented BoxGeometry segments.

### Requirement 11: 3D Model Export

**User Story:** As a user, I want to export the 3D room model, so that I can use it in other tools or 3D print it.

#### Acceptance Criteria

1. WHEN the user clicks the Export STL button, THE Mesh_Exporter SHALL generate a binary STL file with per-face color encoded in the attribute byte count field using 15-bit RGB (5 bits per channel with the valid color bit set).
2. WHEN the user clicks the Export OBJ button, THE Mesh_Exporter SHALL generate a Wavefront OBJ file with vertex positions and triangle face indices.
3. THE Mesh_Exporter SHALL apply the user-configured export scale factor to all mesh dimensions (default 1 for real meters, 0.01 for 1:100 scale).
4. THE Mesh_Exporter SHALL clean the mesh by removing degenerate triangles (triangles with near-zero area) before export.

### Requirement 12: Theme Toggle

**User Story:** As a user, I want to switch between dark and light themes, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHEN the user clicks the theme toggle button, THE Qidar_App SHALL switch the document theme attribute between "dark" and empty, update the toggle button icon (🌙 for light mode, ☀️ for dark mode), update the Three.js renderer background color, and re-render the 2D floor plan with theme-appropriate colors.
2. THE Qidar_App SHALL synchronize the theme toggle between the landing page and the main application shell.

### Requirement 13: Landing Page

**User Story:** As a user, I want to see an informative landing page explaining Feng Shui concepts before entering the app, so that I understand the purpose and workflow.

#### Acceptance Criteria

1. THE Qidar_App SHALL display a landing page with sections explaining Qi, Feng Shui, Yin and Yang, the Bagua Map, the Five Elements (wood, fire, earth, metal, water), and the six-step application workflow.
2. WHEN the user clicks the "Enter Qidar" button, THE Qidar_App SHALL animate the landing page exit and reveal the main application shell.

### Requirement 14: Pipeline Progress Indicator

**User Story:** As a user, I want to see which step of the analysis pipeline is currently running, so that I know the system is working and how far along it is.

#### Acceptance Criteria

1. WHILE the analysis pipeline is running, THE Qidar_App SHALL display a pipeline indicator showing five steps (Convert, Analyze, Plan, Clean, Done) with the current step highlighted and completed steps marked.
2. WHEN the pipeline completes, THE Qidar_App SHALL mark all steps as done.

### Requirement 15: Deployment Configuration

**User Story:** As a developer, I want the application to deploy on Vercel with serverless Python functions, so that the backend scales automatically.

#### Acceptance Criteria

1. THE Qidar_App SHALL serve the Python API endpoints (`/api/model-room` and `/api/health`) as Vercel serverless functions with a maximum duration of 60 seconds.
2. THE Qidar_App SHALL serve the frontend as static files (HTML, CSS, JavaScript) with clean URLs enabled.
3. THE Qidar_App SHALL use import maps to load Three.js and its addons from a CDN without a build step.

### Requirement 16: Local Development Server

**User Story:** As a developer, I want to run the application locally for development, so that I can test changes without deploying.

#### Acceptance Criteria

1. THE Qidar_App SHALL provide a local Python development server (ThreadingHTTPServer) that serves static files and handles the `/api/model-room` POST endpoint and the `/api/health` GET endpoint on a configurable host and port (default 127.0.0.1:4173).

### Requirement 17: Information Display

**User Story:** As a user, I want to see a summary of the room analysis results, so that I understand what the system detected.

#### Acceptance Criteria

1. WHEN analysis is complete, THE Qidar_App SHALL display an info panel showing the room summary, room type, dimensions in feet and inches, floor area in square feet, openings summary, furniture list, and Feng Shui score with verdict.
2. WHEN Feng Shui analysis is complete, THE Qidar_App SHALL display a detail panel showing the score, verdict, individual findings with severity icons, element distribution with icons, and an ordered list of recommendations.

### Requirement 18: Wall Color Sampling

**User Story:** As a user, I want the 3D model walls to reflect the actual colors from my room photo, so that the preview looks realistic.

#### Acceptance Criteria

1. THE Qidar_App SHALL sample average colors from the uploaded image for the left wall, back wall, right wall, and floor regions using the wall zone and horizon coordinates from the Room_Analyzer output.
2. THE Qidar_App SHALL apply the sampled colors to the corresponding wall and floor surfaces in both the 3D mesh export and the Three.js preview.
