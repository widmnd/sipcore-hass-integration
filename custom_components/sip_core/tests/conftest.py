"""Pytest configuration for SIP Core tests.

This configuration prevents pytest from importing the parent package,
which contains Home Assistant imports that may cause circular import errors.
"""
import sys
from types import ModuleType

# Block parent package imports by creating stub modules in sys.modules
# This must happen BEFORE pytest tries to import anything from the parent package
_parent_modules = [
    'custom_components.sip_core',
    'sip_core',
]

for module_name in _parent_modules:
    if module_name not in sys.modules:
        # Create a dummy module to prevent actual import
        stub = ModuleType(module_name)
        stub.__path__ = []  # Make it a package
        stub.__file__ = __file__
        sys.modules[module_name] = stub
