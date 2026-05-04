import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import gmail


class _FailingLlm:
    async def ainvoke(self, _messages):
        raise RuntimeError("assistant fast key rejected")


class _WorkingLlm:
    async def ainvoke(self, _messages):
        return type("Reply", (), {"content": "Bonjour,\n\nMerci pour votre message. Je reviens vers vous rapidement."})()


class GmailAiReplyTests(unittest.IsolatedAsyncioTestCase):
    async def test_retries_global_model_when_assistant_fast_generation_fails(self):
        calls = []

        def fake_get_llm(**kwargs):
            calls.append(kwargs)
            return _FailingLlm() if len(calls) == 1 else _WorkingLlm()

        with patch.object(gmail, "get_llm", side_effect=fake_get_llm):
            result = await gmail.generate_reply_with_ai(
                subject="Question client",
                snippet="Pouvez-vous me confirmer le rendez-vous ?",
                body_text="Bonjour, pouvez-vous me confirmer le rendez-vous de demain ?",
                from_email="client@example.com",
                category="Rendez-vous",
                recommended_action="Confirmer le rendez-vous",
                language="fr",
                tone="professional",
            )

        self.assertTrue(result["aiUsed"])
        self.assertIn("Merci pour votre message", result["suggestedReply"])
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["purpose"], "assistant_fast")
        self.assertEqual(calls[1]["purpose"], "default")


if __name__ == "__main__":
    unittest.main()
