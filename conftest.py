"""Root pytest configuration to prevent parent package imports.

This blocks imports of the custom_components.sip_core package before pytest
can load test files, preventing circular import issues with homeassistant.
"""
import sys
import os
from types import ModuleType
from pathlib import Path

# Get the repository root directory
repo_root = Path(__file__).parent

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
        # Set a valid file path to avoid inspect.getfile() issues
        stub.__file__ = str(repo_root / module_name.replace('.', os.sep) / '__init__.py')
        stub.__package__ = module_name
        sys.modules[module_name] = stub
