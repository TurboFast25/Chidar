# Feature: qidar-room-layout-analyzer, Property 10: Room analysis response contains all required fields
"""
Property-based test for Property 10: Room analysis response contains all required fields.

For any valid payload sent to the Room Analyzer, the response SHALL contain an
`analysis` object with fields (summary, roomType, cameraView, floorPolygon,
wallZones, avoidZones, placementGuidance, lighting, dominantSide, horizonPercent)
and a `roomModel` object with fields (width, depth, height, floorArea, walls).

**Validates: Requirements 3.13**
"""

from hypothesis import given, settings
from strategies import st_room_analysis_payload
from room_analysis import analyze_room


REQUIRED_ANALYSIS_FIELDS = {
    "summary",
    "roomType",
    "cameraView",
    "floorPolygon",
    "wallZones",
    "avoidZones",
    "placementGuidance",
    "lighting",
    "dominantSide",
    "horizonPercent",
}

REQUIRED_ROOM_MODEL_FIELDS = {
    "width",
    "depth",
    "height",
    "floorArea",
    "walls",
}


@given(payload=st_room_analysis_payload(min_dim=10, max_dim=40))
@settings(max_examples=100)
def test_response_contains_all_required_fields(payload):
    """analyze_room returns analysis with 10 required fields and roomModel with 5 required fields."""
    result = analyze_room(payload)

    # Top-level keys
    assert "analysis" in result, "Response missing 'analysis' key"
    assert "roomModel" in result, "Response missing 'roomModel' key"

    # Analysis fields
    analysis = result["analysis"]
    missing_analysis = REQUIRED_ANALYSIS_FIELDS - set(analysis.keys())
    assert not missing_analysis, (
        f"analysis is missing fields: {missing_analysis}"
    )

    # Room model fields
    room_model = result["roomModel"]
    missing_model = REQUIRED_ROOM_MODEL_FIELDS - set(room_model.keys())
    assert not missing_model, (
        f"roomModel is missing fields: {missing_model}"
    )
