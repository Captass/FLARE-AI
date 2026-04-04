import json
import unittest
from datetime import datetime
from unittest.mock import patch

from core.config import settings
from core.organizations import (
    create_organization,
    decode_active_organization,
    encode_active_organization,
    get_organization,
    get_user_role_in_organization,
    list_user_organizations,
    serialize_organization,
    user_can_access_organization,
    user_can_edit_organization,
)


class OrganizationsTestCase(unittest.TestCase):
    def test_default_shared_organization_exposes_roles(self) -> None:
        organizations = list_user_organizations("cptskevin@gmail.com")

        self.assertEqual(len(organizations), 1)
        self.assertEqual(organizations[0]["slug"], "rams-flare")
        self.assertEqual(organizations[0]["current_user_role"], "owner")
        self.assertEqual(organizations[0]["current_user_role_label"], "Proprietaire")
        self.assertTrue(organizations[0]["can_edit_branding"])
        self.assertEqual(organizations[0]["member_count"], 2)

    def test_custom_registry_supports_member_objects(self) -> None:
        custom_registry = json.dumps(
            [
                {
                    "slug": "atelier-vision",
                    "name": "Atelier Vision",
                    "members": [
                        {
                            "email": "owner@example.com",
                            "display_name": "Owner User",
                            "role": "owner",
                        },
                        {
                            "email": "viewer@example.com",
                            "display_name": "Viewer User",
                            "role": "viewer",
                        },
                    ],
                    "enabled_modules": ["chatbot", "assistant"],
                }
            ]
        )

        with patch.object(settings, "ORGANIZATION_REGISTRY_JSON", custom_registry):
            organization = get_organization("atelier-vision")

            self.assertIsNotNone(organization)
            self.assertTrue(user_can_access_organization("viewer@example.com", "atelier-vision"))
            self.assertEqual(
                get_user_role_in_organization("viewer@example.com", organization=organization),
                "viewer",
            )
            self.assertFalse(user_can_edit_organization("viewer@example.com", organization=organization))

            serialized = serialize_organization(organization, "viewer@example.com")
            self.assertEqual(serialized["current_user_role"], "viewer")
            self.assertEqual(serialized["current_user_role_label"], "Lecture")
            self.assertFalse(serialized["can_edit_branding"])
            self.assertFalse(serialized["can_manage_facebook"])
            self.assertEqual(serialized["members"][0]["display_name"], "Owner User")

    def test_create_organization_assigns_creator_as_owner(self) -> None:
        with patch("core.organizations.list_dynamic_organizations", return_value=[]), patch(
            "core.organizations._persist_dynamic_organizations"
        ) as persist_dynamic:
            organization = create_organization("Mon espace test", "owner@example.com")

        self.assertEqual(organization["slug"], "mon-espace-test")
        self.assertTrue(organization["is_dynamic"])
        self.assertEqual(organization["members"][0]["email"], "owner@example.com")
        self.assertEqual(organization["members"][0]["role"], "owner")
        persisted_payload = persist_dynamic.call_args.args[0]
        self.assertEqual(len(persisted_payload), 1)
        self.assertEqual(persisted_payload[0]["members"][0]["role"], "owner")

    def test_active_organization_payload_roundtrip(self) -> None:
        connected_at = datetime(2026, 3, 28, 8, 30, 0)
        payload = encode_active_organization("rams-flare", connected_at)

        slug, decoded_connected_at = decode_active_organization(payload)

        self.assertEqual(slug, "rams-flare")
        self.assertEqual(decoded_connected_at, connected_at)


if __name__ == "__main__":
    unittest.main()
