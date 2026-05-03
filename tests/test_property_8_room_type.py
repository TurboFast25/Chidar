# Feature: qidar-room-layout-analyzer, Property 8: Room type classification is deterministic
"""
Property-based test for Property 8: Room type classification is deterministic.

For any image dimensions (width, height) and occupied zone count, the room type SHALL be
"wide living area" if aspect ratio >= 1.45, "furnished bedroom or lounge" if zone count >= 2,
"compact bedroom" if aspect ratio <= 0.9, or "multi-purpose interior room" otherwise.

**Validates: Requirements 3.8**
"""

from hypothesis import given, settings
from hypothesis import strategies as st
from strategies import st_image_dimensions
from room_analysis import describe_room_type


def st_avoid_zones():
    """Strategy for generating a list of avoid zone dicts (0 to 10 zones)."""
    zone = st.fixed_dictionaries({
        "name": st.text(min_size=1, max_size=20),
        "x": st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
        "y": st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
        "width": st.floats(min_value=1, max_value=100, allow_nan=False, allow_infinity=False),
        "height": st.floats(min_value=1, max_value=100, allow_nan=False, allow_infinity=False),
    })
    return st.lists(zone, min_size=0, max_size=10)


@given(
    dims=st_image_dimensions(min_dim=1, max_dim=1000),
    zones=st_avoid_zones(),
)
@settings(max_examples=100)
def test_room_type_classification_is_deterministic(dims, zones):
    """Room type classification matches the defined aspect ratio and zone count rules."""
    width, height = dims

    result = describe_room_type(width, height, zones)

    aspect_ratio = width / height if height else 1

    if aspect_ratio >= 1.45:
        expected = "wide living area"
    elif len(zones) >= 2:
        expected = "furnished bedroom or lounge"
    elif aspect_ratio <= 0.9:
        expected = "compact bedroom"
    else:
        expected = "multi-purpose interior room"

    assert result == expected, (
        f"Expected '{expected}' for width={width}, height={height}, "
        f"aspect_ratio={aspect_ratio:.4f}, zone_count={len(zones)} but got '{result}'"
    )
