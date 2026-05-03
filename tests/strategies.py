"""
Shared hypothesis strategies for Chidar room analysis property-based tests.

These strategies generate valid inputs for room analysis functions including
payloads, brightness data, calibration objects, and floor polygons.

Feature: qidar-room-layout-analyzer
"""

from hypothesis import strategies as st


def st_image_dimensions(min_dim=10, max_dim=500):
    """Strategy for (imageWidth, imageHeight) pairs."""
    return st.tuples(
        st.integers(min_value=min_dim, max_value=max_dim),
        st.integers(min_value=min_dim, max_value=max_dim),
    )


def st_row_brightness(length=None, min_len=10, max_len=500):
    """Strategy for row brightness arrays (one value per row, 0-255)."""
    if length is not None:
        return st.lists(
            st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False),
            min_size=length,
            max_size=length,
        )
    return st.integers(min_value=min_len, max_value=max_len).flatmap(
        lambda n: st.lists(
            st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False),
            min_size=n,
            max_size=n,
        )
    )


def st_column_energy(length=None, min_len=10, max_len=500):
    """Strategy for column energy arrays (non-negative floats)."""
    if length is not None:
        return st.lists(
            st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
            min_size=length,
            max_size=length,
        )
    return st.integers(min_value=min_len, max_value=max_len).flatmap(
        lambda n: st.lists(
            st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
            min_size=n,
            max_size=n,
        )
    )


def st_overall_brightness():
    """Strategy for overall brightness value (0-255)."""
    return st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False)


def st_brightness_grid(width, height):
    """Strategy for a 2D brightness grid of given dimensions."""
    return st.lists(
        st.lists(
            st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False),
            min_size=width,
            max_size=width,
        ),
        min_size=height,
        max_size=height,
    )


def st_calibration():
    """Strategy for an optional calibration object."""
    return st.one_of(
        st.none(),
        st.fixed_dictionaries({
            "label": st.sampled_from(["door", "window", "person", "chair", "Door Frame"]),
            "realHeightMeters": st.floats(
                min_value=0.5, max_value=3.0, allow_nan=False, allow_infinity=False
            ),
            "pixelsPerMeter": st.floats(
                min_value=10, max_value=500, allow_nan=False, allow_infinity=False
            ),
        }),
    )


def st_calibration_present():
    """Strategy for a calibration object that is always present (non-None)."""
    return st.fixed_dictionaries({
        "label": st.sampled_from(["door", "window", "person", "chair", "Door Frame"]),
        "realHeightMeters": st.floats(
            min_value=0.5, max_value=3.0, allow_nan=False, allow_infinity=False
        ),
        "pixelsPerMeter": st.floats(
            min_value=10, max_value=500, allow_nan=False, allow_infinity=False
        ),
    })


@st.composite
def st_room_analysis_payload(draw, min_dim=10, max_dim=160):
    """
    Composite strategy that generates a complete, valid room analysis payload.

    Returns a dict with keys: imageWidth, imageHeight, rowBrightness,
    columnEnergy, overallBrightness, brightnessGrid (optional), calibration (optional).
    """
    width = draw(st.integers(min_value=min_dim, max_value=max_dim))
    height = draw(st.integers(min_value=min_dim, max_value=max_dim))

    row_brightness = draw(st.lists(
        st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False),
        min_size=height,
        max_size=height,
    ))

    column_energy = draw(st.lists(
        st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
        min_size=width,
        max_size=width,
    ))

    overall_brightness = draw(st.floats(
        min_value=0, max_value=255, allow_nan=False, allow_infinity=False
    ))

    # Optionally include a brightness grid
    include_grid = draw(st.booleans())
    brightness_grid = None
    if include_grid:
        brightness_grid = draw(st.lists(
            st.lists(
                st.floats(min_value=0, max_value=255, allow_nan=False, allow_infinity=False),
                min_size=width,
                max_size=width,
            ),
            min_size=height,
            max_size=height,
        ))

    calibration = draw(st_calibration())

    payload = {
        "imageWidth": width,
        "imageHeight": height,
        "rowBrightness": row_brightness,
        "columnEnergy": column_energy,
        "overallBrightness": overall_brightness,
    }
    if brightness_grid is not None:
        payload["brightnessGrid"] = brightness_grid
    if calibration is not None:
        payload["calibration"] = calibration

    return payload


def st_floor_polygon():
    """Strategy for a floor polygon (list of 4 {x, y} dicts with percentage coords)."""
    return st.lists(
        st.fixed_dictionaries({
            "x": st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
            "y": st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False),
        }),
        min_size=4,
        max_size=4,
    )


def st_display_dimensions():
    """Strategy for display width/height values."""
    return st.tuples(
        st.integers(min_value=100, max_value=2000),
        st.integers(min_value=100, max_value=2000),
    )
