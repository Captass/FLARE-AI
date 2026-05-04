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

    async def test_local_reply_is_actionable_when_all_ai_attempts_fail(self):
        def fake_get_llm(**_kwargs):
            return _FailingLlm()

        with patch.object(gmail, "get_llm", side_effect=fake_get_llm):
            result = await gmail.generate_reply_with_ai(
                subject="Confirmation rendez-vous",
                snippet="Bonjour, pouvez-vous me confirmer le rendez-vous de demain ?",
                body_text="Bonjour, pouvez-vous me confirmer le rendez-vous de demain ? Merci.",
                from_email="client@example.com",
                category="Rendez-vous",
                recommended_action="Confirmer le rendez-vous",
                language="fr",
                tone="professional",
            )

        self.assertFalse(result["aiUsed"])
        self.assertEqual(result["model"], "local-assistant")
        self.assertNotIn("aiError", result)
        self.assertIn("rendez-vous", result["suggestedReply"].lower())

    def test_summary_uses_body_instead_of_html_boilerplate(self):
        raw_html_snippet = (
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" > '
            "<html><head><meta content='date=no' name='format-detection'>"
        )

        summary = gmail._summary_for(
            "Finance",
            raw_html_snippet,
            "Votre paiement Starlink a echoue. Veuillez mettre a jour votre moyen de paiement.",
            subject="Echec du paiement Starlink",
        )

        self.assertIn("paiement Starlink", summary)
        self.assertNotIn("DOCTYPE", summary)
        self.assertNotIn("format-detection", summary)

    def test_summary_falls_back_to_subject_when_only_html_boilerplate_exists(self):
        analysis = gmail.analyze_mail(
            "Swing by for a chance to win our EUR 1,000 competition",
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ><head><meta>',
            "Skrill <noreply@news.skrill.com>",
            "",
            "",
        )

        self.assertIn("Swing by", analysis["summary"])
        self.assertNotIn("DOCTYPE", analysis["summary"])
        self.assertNotIn("head", analysis["summary"].lower())


if __name__ == "__main__":
    unittest.main()
