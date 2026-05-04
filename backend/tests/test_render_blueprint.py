from pathlib import Path
import re
import unittest


class RenderBlueprintTests(unittest.TestCase):
    def test_gemini_keys_are_dashboard_managed_secrets(self):
        blueprint = Path(__file__).resolve().parents[2] / "render.yaml"
        text = blueprint.read_text(encoding="utf-8")

        for key in [
            "ASSISTANT_GMAIL_API_KEY",
            "GMAIL_ASSISTANT_API_KEY",
            "GOOGLE_API_KEY",
            "GEMINI_API_KEY",
            "GEMINI_API_KEY_GLOBAL",
            "GEMINI_API_KEY_CHATBOT",
            "GEMINI_API_KEY_ASSISTANT_REASONING",
            "GEMINI_API_KEY_ASSISTANT_FAST",
        ]:
            self.assertRegex(text, rf"- key: {re.escape(key)}\s*\n\s*sync: false")
            self.assertNotRegex(
                text,
                rf"- key: {re.escape(key)}\s*\n\s*value:\s*[\"']?a_remplir[\"']?",
            )


if __name__ == "__main__":
    unittest.main()
