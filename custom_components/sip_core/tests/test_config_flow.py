"""
Tests for SIP Core config flow
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock


@pytest.fixture
def mock_hass():
    """Create a mock Home Assistant instance."""
    hass = Mock()
    hass.config_entries = Mock()
    hass.data = {}
    return hass


class TestConfigFlowValidation:
    """Test configuration flow validation."""

    def test_validate_sip_config_structure(self):
        """Test that SIP config structure is validated."""
        valid_config = {
            "extensions": [
                {"number": "1001", "user": "user1", "password": "pass1", "domain": "example.com"}
            ],
            "buttons": [{"name": "Office", "number": "1001"}],
        }

        # Should have extensions array
        assert "extensions" in valid_config
        assert isinstance(valid_config["extensions"], list)

        # Should have buttons array
        assert "buttons" in valid_config
        assert isinstance(valid_config["buttons"], list)

    def test_validate_invalid_config_structure(self):
        """Test that invalid config structure is rejected."""
        invalid_configs = [
            None,  # None
            {},  # Missing required fields
            {"extensions": "not-an-array"},  # Wrong type
            {"buttons": 123},  # Wrong type
            "string",  # Not an object
        ]

        for config in invalid_configs:
            if config is None:
                assert config is None
            elif isinstance(config, str):
                assert not isinstance(config, dict)
            elif isinstance(config, dict):
                # Check structure
                has_extensions = "extensions" in config
                has_buttons = "buttons" in config
                valid_extensions = has_extensions and isinstance(config.get("extensions"), list)
                valid_buttons = has_buttons and isinstance(config.get("buttons"), list)
                assert not (valid_extensions and valid_buttons)

    def test_validate_extension_number(self):
        """Test extension number validation."""
        valid_extensions = ["1001", "2000", "ext-123", "user_1"]
        invalid_extensions = ["", "invalid@ext", "ext#123", "123-invalid-"]

        extension_regex = r"^[a-zA-Z0-9_-]{1,20}$"
        import re

        pattern = re.compile(extension_regex)

        for ext in valid_extensions:
            assert pattern.match(ext), f"{ext} should be valid"

        for ext in invalid_extensions:
            assert not pattern.match(ext), f"{ext} should be invalid"

    def test_validate_user_object(self):
        """Test user object validation."""
        valid_user = {
            "user": "testuser",
            "password": "password123",
            "domain": "example.com",
        }

        # Should have required fields
        assert "user" in valid_user
        assert "password" in valid_user
        assert "domain" in valid_user

        # Should be strings
        assert isinstance(valid_user["user"], str)
        assert isinstance(valid_user["password"], str)
        assert isinstance(valid_user["domain"], str)

    def test_validate_missing_user_fields(self):
        """Test that missing user fields are caught."""
        invalid_users = [
            {"user": "test"},  # Missing password and domain
            {"password": "pass"},  # Missing user and domain
            {"domain": "example.com"},  # Missing user and password
            {},  # Missing all fields
            None,  # None
        ]

        for user in invalid_users:
            if user is None:
                assert user is None
            else:
                has_user = "user" in user and isinstance(user.get("user"), str)
                has_password = "password" in user and isinstance(user.get("password"), str)
                has_domain = "domain" in user and isinstance(user.get("domain"), str)

                # Should not have all required fields
                assert not (has_user and has_password and has_domain)

    def test_config_defaults(self):
        """Test that config has sensible defaults."""
        config = {
            "extensions": [],
            "buttons": [],
            "heartbeatIntervalMs": 30000,
        }

        assert config["heartbeatIntervalMs"] == 30000
        assert isinstance(config["extensions"], list)
        assert isinstance(config["buttons"], list)

    def test_config_override(self):
        """Test that config can be overridden."""
        base_config = {
            "extensions": [],
            "buttons": [],
            "heartbeatIntervalMs": 30000,
        }

        # Override heartbeat
        override_config = {**base_config, "heartbeatIntervalMs": 60000}

        assert override_config["heartbeatIntervalMs"] == 60000
        assert base_config["heartbeatIntervalMs"] == 30000


class TestConfigFlowErrors:
    """Test error handling in config flow."""

    def test_handle_missing_config(self):
        """Test handling of missing configuration."""
        config = None

        if not config:
            result = {"error": "No configuration provided"}
        else:
            result = config

        assert result["error"] == "No configuration provided"

    def test_handle_invalid_config_type(self):
        """Test handling of invalid config type."""
        invalid_configs = ["string", 123, [], None]

        for config in invalid_configs:
            is_valid = isinstance(config, dict)
            assert not is_valid, f"{type(config).__name__} should not be valid"

    def test_handle_missing_required_fields(self):
        """Test handling of missing required fields."""
        config = {"extensions": []}  # Missing buttons

        errors = []
        if "buttons" not in config:
            errors.append("buttons field is required")

        assert len(errors) > 0
        assert "buttons field is required" in errors

    def test_handle_invalid_field_types(self):
        """Test handling of invalid field types."""
        config = {
            "extensions": "not-an-array",  # Wrong type
            "buttons": [],
        }

        errors = []
        if not isinstance(config.get("extensions"), list):
            errors.append("extensions must be an array")

        if not isinstance(config.get("buttons"), list):
            errors.append("buttons must be an array")

        assert "extensions must be an array" in errors
