"""Root pytest configuration to prevent parent package imports.

This blocks imports of the custom_components.sip_core package before pytest
can load test files, preventing circular import issues with homeassistant.
"""
import sys
from types import ModuleType

# Block parent package imports by creating stub modules in sys.modules
# This must happen at the ROOT level before pytest descends into subdirectories
_blocked_modules = [
    'custom_components',
    'custom_components.sip_core',
]

for module_name in _blocked_modules:
    if module_name not in sys.modules:
        # Create a dummy module to prevent actual import
        stub = ModuleType(module_name)
        stub.__path__ = []  # Make it a package
        stub.__file__ = ''
        sys.modules[module_name] = stub
