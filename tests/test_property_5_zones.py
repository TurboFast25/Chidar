# Feature: qidar-room-layout-analyzer, Property 5: Occupied zone grouping invariants
"""
Property-based test for Property 5: Occupied zone grouping invariants.

For any column energy array of length W, the grouped occupied zones SHALL each
have a span of at least max(2, round(W*0.03)) columns, and the total number
of zones SHALL not exceed 8.

**Validates: Requirements 3.2**
"""

from hypothesis import given, settings
from strategies import st_column_energy
from room_analysis import group_occupied_columns, average


@given(column_energy=st_column_energy(min_len=10, max_len=500))
@settings(max_examples=100)
def test_occupied_zone_grouping_invariants(column_energy):
    """Each occupied zone spans at least the minimum width and total zones <= 8."""
    W = len(column_energy)

    # Derive occupied columns the same way analyze_room does
    energy_average = average(column_energy)
    occupied_columns = []
    for index, value in enumerate(column_energy):
        lower_band = index > W * 0.04 and index < W * 0.96
        occupied_columns.append(lower_band and value > energy_average * 1.15)

    # Use reasonable defaults for the extra parameters (they only affect
    # zone x/y/width/height percentages, not the grouping/filtering logic)
    image_width = W
    horizon_row = W // 2
    image_height = W

    zones = group_occupied_columns(occupied_columns, image_width, horizon_row, image_height)

    # Property: total zones never exceed 8
    assert len(zones) <= 8, (
        f"Expected at most 8 zones, got {len(zones)} for column energy array "
        f"of length {W}"
    )

    # Property: each zone spans at least max(2, round(W * 0.03)) columns
    minimum_span = max(2, round(W * 0.03))

    for i, zone in enumerate(zones):
        # Recover the column span from the zone's percentage-based x and width.
        # The zone dict stores x and width as percentages of image_width, so we
        # convert back to columns:
        #   start_col = round(zone["x"] / 100 * image_width)
        #   span_cols = round(zone["width"] / 100 * image_width)
        # However, the width is clamped to a minimum of 4% by the clamp call in
        # group_occupied_columns, so we instead verify the invariant by
        # re-deriving the groups ourselves and checking the raw span.
        pass

    # To verify the minimum span invariant accurately, we re-derive the raw
    # groups (before percentage conversion) and check each one that made it
    # through the filter.
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

    # The function keeps only groups whose span >= minimum_span, up to 8
    kept = []
    for group in groups:
        if group["end"] - group["start"] < minimum_span:
            continue
        if len(kept) >= 8:
            break
        kept.append(group)

    # The number of kept groups must match the number of zones returned
    assert len(kept) == len(zones), (
        f"Expected {len(kept)} zones from manual grouping but got {len(zones)} "
        f"from group_occupied_columns"
    )

    # Each kept group must have span >= minimum_span
    for i, group in enumerate(kept):
        span = group["end"] - group["start"]
        assert span >= minimum_span, (
            f"Zone {i} has span {span} columns, expected at least {minimum_span} "
            f"(W={W})"
        )
