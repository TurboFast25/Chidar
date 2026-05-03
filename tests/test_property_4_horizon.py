# Feature: qidar-room-layout-analyzer, Property 4: Horizon line is within valid range
"""
Property-based test for Property 4: Horizon line is within valid range.

For any row brightness array of length H >= 10, find_horizon_row returns
a value between max(4, floor(H*0.28)) and min(H-4, floor(H*0.78)).

**Validates: Requirements 3.1**
"""

import math

from hypothesis import given, settings
from strategies import st_row_brightness
from room_analysis import find_horizon_row


@given(row_brightness=st_row_brightness(min_len=10, max_len=500))
@settings(max_examples=100)
def test_horizon_row_within_valid_range(row_brightness):
    """Horizon row index is always within the valid search range."""
    H = len(row_brightness)

    # Compute row gradients the same way analyze_room does
    row_gradients = [0]
    for i in range(1, H):
        row_gradients.append(abs(row_brightness[i] - row_brightness[i - 1]))

    result = find_horizon_row(row_brightness, row_gradients)

    lower_bound = max(4, math.floor(H * 0.28))
    upper_bound = min(H - 4, math.floor(H * 0.78))

    assert lower_bound <= result <= upper_bound, (
        f"Horizon row {result} out of valid range [{lower_bound}, {upper_bound}] "
        f"for array of length {H}"
    )
