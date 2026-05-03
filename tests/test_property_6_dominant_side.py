# Feature: qidar-room-layout-analyzer, Property 6: Dominant side classification follows threshold rule
"""
Property-based test for Property 6: Dominant side classification follows threshold rule.

For any column energy array, if the average energy of the left half exceeds the
right half by more than 10%, the dominant side SHALL be "left"; if the right
exceeds the left by more than 10%, it SHALL be "right"; otherwise it SHALL be
"center".

**Validates: Requirements 3.4**
"""

from hypothesis import given, settings
from strategies import st_room_analysis_payload
from room_analysis import analyze_room, average


@given(payload=st_room_analysis_payload(min_dim=10, max_dim=40))
@settings(max_examples=100)
def test_dominant_side_classification_follows_threshold_rule(payload):
    """Dominant side matches the 10% threshold rule on column energy halves."""
    column_energy = payload["columnEnergy"]
    image_width = payload["imageWidth"]

    # Compute left/right averages the same way analyze_room does
    halfway = max(1, image_width // 2)
    left_energy = average(column_energy[:halfway])
    right_energy = average(column_energy[halfway:])

    # Determine expected dominant side using the threshold rule
    if left_energy > right_energy * 1.1:
        expected = "left"
    elif right_energy > left_energy * 1.1:
        expected = "right"
    else:
        expected = "center"

    # Call analyze_room and check the dominantSide field
    result = analyze_room(payload)
    actual = result["analysis"]["dominantSide"]

    assert actual == expected, (
        f"Expected dominantSide='{expected}' but got '{actual}'. "
        f"left_energy={left_energy:.4f}, right_energy={right_energy:.4f}, "
        f"image_width={image_width}, halfway={halfway}"
    )
