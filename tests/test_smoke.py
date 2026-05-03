"""
Smoke test to verify pytest discovers and runs tests in the Chidar test suite.
"""

import room_analysis


def test_smoke_import():
    """Verify that room_analysis module can be imported."""
    assert hasattr(room_analysis, "analyze_room")
    assert hasattr(room_analysis, "find_horizon_row")
    assert hasattr(room_analysis, "group_occupied_columns")
    assert hasattr(room_analysis, "describe_lighting")
    assert hasattr(room_analysis, "describe_room_type")
    assert hasattr(room_analysis, "estimate_room_width_meters")
    assert hasattr(room_analysis, "estimate_room_depth_meters")
    assert hasattr(room_analysis, "estimate_room_height_meters")


def test_smoke_hypothesis_available():
    """Verify that hypothesis is installed and importable."""
    from hypothesis import given, strategies as st
    assert callable(given)
    assert hasattr(st, "integers")
