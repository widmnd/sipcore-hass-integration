import logging
import voluptuous as vol
from typing import Any

from homeassistant.core import callback
from homeassistant.config_entries import ConfigFlowResult, OptionsFlow, ConfigFlow, ConfigEntry
from homeassistant.helpers.selector import ObjectSelector
from .const import DOMAIN
from .defaults import sip_config

logger: logging.Logger = logging.getLogger(__name__)


class SipCoreConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for SIP Core."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle user configuration step."""
        # Abort if already configured
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        
        # If no user input, show empty form
        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema({
                    vol.Optional("config_url", description={"suggested_value": ""}): str,
                }),
                description_placeholders={
                    "config_info": "SIP Core configuration can be managed through Home Assistant options."
                }
            )
        
        # Validate that configuration is not empty if provided
        if user_input:
            return self.async_create_entry(title="SIP Core", data=user_input)
        
        # Empty configuration is allowed - will use defaults
        return self.async_create_entry(title="SIP Core", data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry[Any]) -> "SipCoreOptionsFlowHandler":
        """Get the options flow."""
        return SipCoreOptionsFlowHandler()


class SipCoreOptionsFlowHandler(OptionsFlow):
    """Handle SIP Core options flow."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage the SIP Core options."""
        if user_input is not None:
            # Validate that sip_config is provided and is a dictionary
            if "sip_config" not in user_input or not isinstance(user_input.get("sip_config"), dict):
                return self.async_show_form(
                    step_id="init",
                    data_schema=vol.Schema({
                        vol.Required(
                            "sip_config",
                            description={
                                "suggested_value": self.config_entry.options.get("sip_config", sip_config),
                            }
                        ): ObjectSelector(),
                    }),
                    errors={"base": "invalid_config"}
                )
            
            return self.async_create_entry(title="SIP Core", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(
                    "sip_config",
                    description={
                        "suggested_value": self.config_entry.options.get("sip_config", sip_config),
                    }
                ): ObjectSelector(),
            })
        )
