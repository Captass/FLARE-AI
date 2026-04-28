import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from core.database import UserIntegration
from core.encryption_service import encryption_service

logger = logging.getLogger(__name__)


@dataclass
class GmailTokenRecord:
    user_id: str
    account_email: str
    refresh_token: str


class GmailTokenStore:
    """
    Storage abstraction for Gmail OAuth tokens.

    V1 stores refresh tokens in the existing user_integrations table.
    TODO production: enforce encryption key rotation and audit access to OAuth tokens.
    """

    integration_type = "gmail"

    def get(self, db: Session, user_id: str) -> Optional[GmailTokenRecord]:
        integration = (
            db.query(UserIntegration)
            .filter(
                UserIntegration.user_id == user_id,
                UserIntegration.integration_type == self.integration_type,
                UserIntegration.is_active == "true",
            )
            .first()
        )
        if not integration or not integration.refresh_token_encrypted:
            return None
        return GmailTokenRecord(
            user_id=user_id,
            account_email=integration.account_email or "",
            refresh_token=encryption_service.decrypt(integration.refresh_token_encrypted),
        )

    def save(self, db: Session, user_id: str, account_email: str, refresh_token: str) -> None:
        encrypted_refresh_token = encryption_service.encrypt(refresh_token)
        integration = (
            db.query(UserIntegration)
            .filter(
                UserIntegration.user_id == user_id,
                UserIntegration.integration_type == self.integration_type,
            )
            .first()
        )
        if integration:
            integration.account_email = account_email
            integration.refresh_token_encrypted = encrypted_refresh_token
            integration.is_active = "true"
        else:
            db.add(
                UserIntegration(
                    user_id=user_id,
                    integration_type=self.integration_type,
                    account_email=account_email,
                    refresh_token_encrypted=encrypted_refresh_token,
                    is_active="true",
                )
            )
        db.commit()

    def disconnect(self, db: Session, user_id: str) -> None:
        integration = (
            db.query(UserIntegration)
            .filter(
                UserIntegration.user_id == user_id,
                UserIntegration.integration_type == self.integration_type,
            )
            .first()
        )
        if integration:
            integration.is_active = "false"
            db.commit()


gmail_token_store = GmailTokenStore()
