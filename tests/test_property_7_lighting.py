# Feature: qidar-room-layout-analyzer, Property 7: Lighting classification matches brightness thresholds
"""
Property-based test for Property 7: Lighting classification matches brightness thresholds.

For any overall brightness value B, the lighting description SHALL be
"bright daylight" if B >= 190, "balanced ambient light" if 145 <= B < 190,
"soft interior light" if 105 <= B < 145, or "dim interior light" if B < 105.

**Validates: Requirements 3.7**
"""

from hypothesis import given, settings
from strategies import st_overall_brightness
from room_analysis import describe_lighting


@given(brightness=st_overall_brightness())
@settings(max_examples=100)
def test_lighting_classification_matches_brightness_thresholds(brightness):
    """Lighting description matches the defined brightness thresholds."""
    result = describe_lighting(brightness)

    if brightness >= 190:
        expected = "bright daylight"
    elif brightness >= 145:
        expected = "balanced ambient light"
    elif brightness >= 105:
        expected = "soft interior light"
    else:
        expected = "dim interior light"

    assert result == expected, (
        f"Expected '{expected}' for brightness={brightness:.4f} but got '{result}'"
    )
