# Feature: qidar-room-layout-analyzer, Property 9: Room dimension estimates are within clamped ranges
"""
Property-based test for Property 9: Room dimension estimates are within clamped ranges.

For any valid analysis payload, the estimated room width SHALL be within
[3.2, 7.5] meters without calibration (or [2.8, 10] with calibration),
the depth SHALL be within [3.5, 9] meters without calibration (or [3, 12]
with calibration), and the height SHALL be 2.7 meters without calibration
(or within [2.2, 4] with calibration).

**Validates: Requirements 3.10, 3.11, 3.12**
"""

from hypothesis import given, settings
from strategies import (
    st_floor_polygon,
    st_calibration_present,
    st_display_dimensions,
)
from room_analysis import (
    estimate_room_width_meters,
    estimate_room_depth_meters,
    estimate_room_height_meters,
)


# ---------------------------------------------------------------------------
# Width — without calibration
# ---------------------------------------------------------------------------
@given(
    floor_polygon=st_floor_polygon(),
    display_dims=st_display_dimensions(),
)
@settings(max_examples=100)
def test_width_without_calibration_in_range(floor_polygon, display_dims):
    """Room width without calibration is clamped to [3.2, 7.5]."""
    display_width, _ = display_dims
    result = estimate_room_width_meters(floor_polygon, None, display_width)
    assert 3.2 <= result <= 7.5, (
        f"Width without calibration was {result}, expected in [3.2, 7.5]"
    )


# ---------------------------------------------------------------------------
# Width — with calibration
# ---------------------------------------------------------------------------
@given(
    floor_polygon=st_floor_polygon(),
    calibration=st_calibration_present(),
    display_dims=st_display_dimensions(),
)
@settings(max_examples=100)
def test_width_with_calibration_in_range(floor_polygon, calibration, display_dims):
    """Room width with calibration is clamped to [2.8, 10]."""
    display_width, _ = display_dims
    result = estimate_room_width_meters(floor_polygon, calibration, display_width)
    assert 2.8 <= result <= 10, (
        f"Width with calibration was {result}, expected in [2.8, 10]"
    )


# ---------------------------------------------------------------------------
# Depth — without calibration
# ---------------------------------------------------------------------------
@given(
    floor_polygon=st_floor_polygon(),
    display_dims=st_display_dimensions(),
)
@settings(max_examples=100)
def test_depth_without_calibration_in_range(floor_polygon, display_dims):
    """Room depth without calibration is clamped to [3.5, 9]."""
    _, display_height = display_dims
    result = estimate_room_depth_meters(floor_polygon, None, display_height)
    assert 3.5 <= result <= 9, (
        f"Depth without calibration was {result}, expected in [3.5, 9]"
    )


# ---------------------------------------------------------------------------
# Depth — with calibration
# ---------------------------------------------------------------------------
@given(
    floor_polygon=st_floor_polygon(),
    calibration=st_calibration_present(),
    display_dims=st_display_dimensions(),
)
@settings(max_examples=100)
def test_depth_with_calibration_in_range(floor_polygon, calibration, display_dims):
    """Room depth with calibration is clamped to [3, 12]."""
    _, display_height = display_dims
    result = estimate_room_depth_meters(floor_polygon, calibration, display_height)
    assert 3 <= result <= 12, (
        f"Depth with calibration was {result}, expected in [3, 12]"
    )


# ---------------------------------------------------------------------------
# Height — without calibration
# ---------------------------------------------------------------------------
def test_height_without_calibration_is_fixed():
    """Room height without calibration is exactly 2.7."""
    result = estimate_room_height_meters(None)
    assert result == 2.7, (
        f"Height without calibration was {result}, expected 2.7"
    )


# ---------------------------------------------------------------------------
# Height — with calibration
# ---------------------------------------------------------------------------
@given(calibration=st_calibration_present())
@settings(max_examples=100)
def test_height_with_calibration_in_range(calibration):
    """Room height with calibration is clamped to [2.2, 4]."""
    result = estimate_room_height_meters(calibration)
    assert 2.2 <= result <= 4, (
        f"Height with calibration was {result}, expected in [2.2, 4]"
    )
