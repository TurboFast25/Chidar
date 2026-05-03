"""
Smoke test to verify shared hypothesis strategies generate valid data.
"""

from hypothesis import given, settings
from strategies import (
    st_image_dimensions,
    st_row_brightness,
    st_column_energy,
    st_overall_brightness,
    st_calibration,
    st_room_analysis_payload,
    st_floor_polygon,
    st_display_dimensions,
)


@given(dims=st_image_dimensions())
@settings(max_examples=10)
def test_image_dimensions_strategy(dims):
    w, h = dims
    assert 10 <= w <= 500
    assert 10 <= h <= 500


@given(rb=st_row_brightness(length=20))
@settings(max_examples=10)
def test_row_brightness_strategy(rb):
    assert len(rb) == 20
    assert all(0 <= v <= 255 for v in rb)


@given(ce=st_column_energy(length=30))
@settings(max_examples=10)
def test_column_energy_strategy(ce):
    assert len(ce) == 30
    assert all(0 <= v <= 1000 for v in ce)


@given(ob=st_overall_brightness())
@settings(max_examples=10)
def test_overall_brightness_strategy(ob):
    assert 0 <= ob <= 255


@given(cal=st_calibration())
@settings(max_examples=10)
def test_calibration_strategy(cal):
    if cal is not None:
        assert "label" in cal
        assert "realHeightMeters" in cal
        assert "pixelsPerMeter" in cal


@given(payload=st_room_analysis_payload(min_dim=10, max_dim=40))
@settings(max_examples=10)
def test_room_analysis_payload_strategy(payload):
    assert "imageWidth" in payload
    assert "imageHeight" in payload
    assert "rowBrightness" in payload
    assert "columnEnergy" in payload
    assert "overallBrightness" in payload
    assert len(payload["rowBrightness"]) == payload["imageHeight"]
    assert len(payload["columnEnergy"]) == payload["imageWidth"]


@given(fp=st_floor_polygon())
@settings(max_examples=10)
def test_floor_polygon_strategy(fp):
    assert len(fp) == 4
    for pt in fp:
        assert "x" in pt and "y" in pt


@given(dd=st_display_dimensions())
@settings(max_examples=10)
def test_display_dimensions_strategy(dd):
    w, h = dd
    assert 100 <= w <= 2000
    assert 100 <= h <= 2000
