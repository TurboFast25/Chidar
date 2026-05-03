"""
Shared pytest configuration for Chidar room analysis tests.

Configures hypothesis profiles and ensures room_analysis is importable.

Feature: qidar-room-layout-analyzer
"""

import sys
import os

# Add the Chidar root to sys.path so room_analysis can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Add the tests directory to sys.path so strategies module can be imported
sys.path.insert(0, os.path.dirname(__file__))

from hypothesis import settings, HealthCheck

# ---------------------------------------------------------------------------
# Hypothesis default profile: minimum 100 examples per property test
# ---------------------------------------------------------------------------
settings.register_profile(
    "default",
    max_examples=100,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.register_profile(
    "ci",
    max_examples=200,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.load_profile("default")
