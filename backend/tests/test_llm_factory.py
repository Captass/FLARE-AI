import sys
import types
import unittest
from unittest.mock import patch

from backend.core import llm_factory


class FakeChatGoogleGenerativeAI:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.instances.append(kwargs)


class LlmFactoryTests(unittest.TestCase):
    def setUp(self):
        self._settings_keys = [
            "LLM_PROVIDER",
            "GEMINI_API_KEY",
            "GEMINI_API_KEY_GLOBAL",
            "GEMINI_API_KEY_CHATBOT",
            "GEMINI_API_KEY_ASSISTANT_REASONING",
            "GEMINI_API_KEY_ASSISTANT_FAST",
        ]
        self._original_settings = {
            key: getattr(llm_factory.settings, key)
            for key in self._settings_keys
        }
        FakeChatGoogleGenerativeAI.instances = []

    def tearDown(self):
        for key, value in self._original_settings.items():
            setattr(llm_factory.settings, key, value)

    def _patch_google_module(self):
        fake_module = types.SimpleNamespace(ChatGoogleGenerativeAI=FakeChatGoogleGenerativeAI)
        return patch.dict(sys.modules, {"langchain_google_genai": fake_module})

    def test_gemini_uses_legacy_key_when_global_key_is_missing(self):
        setattr(llm_factory.settings, "LLM_PROVIDER", "gemini")
        setattr(llm_factory.settings, "GEMINI_API_KEY", "legacy-real-key")
        setattr(llm_factory.settings, "GEMINI_API_KEY_GLOBAL", "a_remplir")
        setattr(llm_factory.settings, "GEMINI_API_KEY_CHATBOT", None)
        setattr(llm_factory.settings, "GEMINI_API_KEY_ASSISTANT_REASONING", None)
        setattr(llm_factory.settings, "GEMINI_API_KEY_ASSISTANT_FAST", None)

        with self._patch_google_module():
            llm_factory.get_llm(model_override="gemini-test", purpose="default")

        self.assertEqual(
            FakeChatGoogleGenerativeAI.instances[-1]["google_api_key"],
            "legacy-real-key",
        )

    def test_gemini_specific_key_wins_over_global_and_legacy_keys(self):
        setattr(llm_factory.settings, "LLM_PROVIDER", "gemini")
        setattr(llm_factory.settings, "GEMINI_API_KEY", "legacy-real-key")
        setattr(llm_factory.settings, "GEMINI_API_KEY_GLOBAL", "global-real-key")
        setattr(llm_factory.settings, "GEMINI_API_KEY_CHATBOT", None)
        setattr(llm_factory.settings, "GEMINI_API_KEY_ASSISTANT_REASONING", None)
        setattr(llm_factory.settings, "GEMINI_API_KEY_ASSISTANT_FAST", "fast-real-key")

        with self._patch_google_module():
            llm_factory.get_llm(model_override="gemini-test", purpose="assistant_fast")

        self.assertEqual(
            FakeChatGoogleGenerativeAI.instances[-1]["google_api_key"],
            "fast-real-key",
        )


if __name__ == "__main__":
    unittest.main()
