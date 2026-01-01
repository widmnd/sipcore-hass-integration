"""Pytest configuration for SIP Core tests.

This configuration prevents pytest from importing the parent package,
which contains Home Assistant imports that may cause circular import errors.
"""
from pathlib import Path


def pytest_ignore_collect(collection_path, config):
    """Ignore parent package files during collection."""
    # Prevent collection of parent package __init__.py
    if collection_path.name == "__init__.py":
        parent = collection_path.parent
        if parent.name == "sip_core" and parent.parent.name == "custom_components":
            return True
    return False
