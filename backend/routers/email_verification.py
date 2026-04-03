"""
Router Email Verification — FLARE AI
Inscription sécurisée : code PIN 6 chiffres envoyé par email.

Flow :
  1. POST /api/auth/send-pin  → génère un PIN, le stocke en DB, envoie l'email
  2. POST /api/auth/verify-pin → vérifie le PIN, retourne succès ou erreur
  3. Frontend crée le compte Firebase uniquement après validation du PIN
"""
import logging
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from core.config import settings
from core.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Constantes ────────────────────────────────────────────────────────────────
PIN_EXPIRY_MINUTES = 10
MAX_ATTEMPTS = 5
MAX_SENDS_PER_HOUR = 3


# ── Modèles Pydantic ──────────────────────────────────────────────────────────
class SendPinRequest(BaseModel):
    email: str


class VerifyPinRequest(BaseModel):
    email: str
    pin: str


# ── Helpers DB ────────────────────────────────────────────────────────────────

def _ensure_table(db) -> None:
    """Crée la table email_verification_codes si elle n'existe pas.
    Compatible SQLite (dev) et PostgreSQL (prod)."""
    is_pg = "postgresql" in settings.DATABASE_URL
    if is_pg:
        sql = """
        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    else:
        sql = """
        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    db.execute(text(sql))
    db.commit()


def _generate_pin() -> str:
    """Génère un PIN à 6 chiffres cryptographiquement sûr."""
    return f"{random.SystemRandom().randint(0, 999999):06d}"


# ── Envoi email ───────────────────────────────────────────────────────────────

def _send_email(to_email: str, pin: str) -> bool:
    """Envoie le PIN par email SMTP. Retourne True si succès."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("[email_verification] SMTP non configuré — PIN non envoyé (mode dev)")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Votre code de vérification FLARE AI : {pin}"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to_email

        text_body = (
            f"Bonjour,\n\n"
            f"Votre code de vérification FLARE AI est : {pin}\n\n"
            f"Ce code expire dans {PIN_EXPIRY_MINUTES} minutes.\n\n"
            f"Si vous n'avez pas demandé ce code, ignorez ce message.\n\n"
            f"— FLARE AI"
        )

        html_body = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:18px;border:1px solid #2a2a3a;overflow:hidden;max-width:480px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FLARE AI</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.65);font-size:13px;letter-spacing:0.5px;">Code de vérification d'inscription</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 32px;text-align:center;">
            <p style="margin:0 0 28px;color:#a0a0b8;font-size:15px;line-height:1.6;">
              Entrez ce code dans l'application pour finaliser votre inscription :
            </p>
            <!-- PIN Box -->
            <div style="display:inline-block;background:#1a1a28;border:2px solid #f97316;border-radius:14px;padding:22px 44px;margin:0 0 28px;">
              <span style="font-size:40px;font-weight:800;color:#fb923c;letter-spacing:14px;font-family:'Courier New',monospace;">{pin}</span>
            </div>
            <p style="margin:0;color:#6b6b80;font-size:13px;">
              ⏱&nbsp; Ce code expire dans <strong style="color:#a0a0b8;">{PIN_EXPIRY_MINUTES} minutes</strong>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;border-top:1px solid #2a2a3a;">
            <p style="margin:24px 0 6px;color:#6b6b80;font-size:12px;">
              Si vous n'avez pas demandé ce code, ignorez ce message. Votre compte n'a pas été créé.
            </p>
            <p style="margin:0;color:#4a4a5a;font-size:11px;">
              © FLARE AI — <a href="https://flareai.ramsflare.com" style="color:#f97316;text-decoration:none;">flareai.ramsflare.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)

        logger.info(f"[email_verification] PIN envoyé à {to_email}")
        return True

    except Exception as e:
        logger.error(f"[email_verification] Erreur envoi email à {to_email}: {e}")
        return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send-pin")
async def send_verification_pin(body: SendPinRequest):
    """
    Génère un PIN 6 chiffres et l'envoie par email.
    - Rate limit : max 3 envois par email dans la dernière heure.
    - Invalide automatiquement les anciens codes non utilisés.
    - En mode dev (SMTP non configuré), retourne le PIN dans la réponse.
    """
    email = body.email.strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Adresse email invalide")

    db = SessionLocal()
    try:
        _ensure_table(db)

        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)

        # Rate limiting : max MAX_SENDS_PER_HOUR envois par email/heure
        result = db.execute(
            text("SELECT COUNT(*) FROM email_verification_codes WHERE email = :email AND created_at > :since"),
            {"email": email, "since": one_hour_ago.isoformat()},
        )
        recent_count = result.scalar() or 0

        if recent_count >= MAX_SENDS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail=f"Trop de codes demandés. Attendez 1 heure avant de réessayer.",
            )

        # Invalider les anciens codes non utilisés pour cet email
        db.execute(
            text("UPDATE email_verification_codes SET used = 1 WHERE email = :email AND used = 0"),
            {"email": email},
        )

        # Générer et stocker le nouveau PIN
        pin = _generate_pin()
        expires_at = (now + timedelta(minutes=PIN_EXPIRY_MINUTES)).isoformat()

        db.execute(
            text(
                "INSERT INTO email_verification_codes (email, code, expires_at, used, attempts, created_at) "
                "VALUES (:email, :code, :expires_at, 0, 0, :created_at)"
            ),
            {"email": email, "code": pin, "expires_at": expires_at, "created_at": now.isoformat()},
        )
        db.commit()

        # Envoyer l'email
        sent = _send_email(email, pin)

        if not sent:
            # Mode dev : pas de SMTP, on log et retourne le PIN
            logger.info(f"[DEV] PIN pour {email}: {pin}")
            return {
                "status": "dev_mode",
                "message": "SMTP non configuré — code disponible ci-dessous (mode développement uniquement)",
                "dev_pin": pin,
            }

        return {"status": "sent", "message": f"Code envoyé à {email}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[email_verification] Erreur send-pin: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du code. Réessayez.")
    finally:
        db.close()


@router.post("/verify-pin")
async def verify_pin(body: VerifyPinRequest):
    """
    Vérifie un PIN 6 chiffres.
    - Max MAX_ATTEMPTS tentatives par code.
    - Code à usage unique (marqué used=1 après validation).
    - Retourne le nombre de tentatives restantes en cas d'échec.
    """
    email = body.email.strip().lower()
    pin = body.pin.strip()

    if not email or not pin or len(pin) != 6 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="Données invalides")

    db = SessionLocal()
    try:
        _ensure_table(db)

        now = datetime.now(timezone.utc)

        # Chercher le code valide le plus récent pour cet email
        result = db.execute(
            text(
                "SELECT code, expires_at, attempts FROM email_verification_codes "
                "WHERE email = :email AND used = 0 "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"email": email},
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=400, detail="Aucun code actif pour cet email. Demandez un nouveau code.")

        stored_code, expires_at_str, attempts = row

        # Vérifier l'expiration
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except Exception:
            expires_at = now - timedelta(seconds=1)  # Forcer expiration si format invalide

        if now > expires_at:
            db.execute(
                text("UPDATE email_verification_codes SET used = 1 WHERE email = :email AND used = 0"),
                {"email": email},
            )
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"Code expiré. Les codes sont valables {PIN_EXPIRY_MINUTES} minutes. Demandez un nouveau code.",
            )

        # Vérifier le nombre de tentatives
        if attempts >= MAX_ATTEMPTS:
            db.execute(
                text("UPDATE email_verification_codes SET used = 1 WHERE email = :email AND used = 0"),
                {"email": email},
            )
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Trop de tentatives incorrectes. Demandez un nouveau code.",
            )

        # Vérifier le PIN
        if pin != stored_code:
            db.execute(
                text("UPDATE email_verification_codes SET attempts = attempts + 1 WHERE email = :email AND used = 0"),
                {"email": email},
            )
            db.commit()
            remaining = MAX_ATTEMPTS - (attempts + 1)
            if remaining <= 0:
                db.execute(
                    text("UPDATE email_verification_codes SET used = 1 WHERE email = :email AND used = 0"),
                    {"email": email},
                )
                db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="Trop de tentatives incorrectes. Demandez un nouveau code.",
                )
            raise HTTPException(
                status_code=400,
                detail=f"Code incorrect. {remaining} tentative(s) restante(s).",
            )

        # Succès — marquer le code comme utilisé
        db.execute(
            text("UPDATE email_verification_codes SET used = 1 WHERE email = :email AND used = 0"),
            {"email": email},
        )
        db.commit()

        logger.info(f"[email_verification] Email vérifié avec succès: {email}")
        return {"status": "verified", "message": "Email vérifié avec succès"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[email_verification] Erreur verify-pin: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la vérification. Réessayez.")
    finally:
        db.close()
