"""BIDE adapter for the shared fujioky-auth package."""
from sqlalchemy import select, update
from fujioky_auth import AuthConfig, AuthManager, safe_next, upsert_standard_user

from .config import settings
from .db import Base, get_db
from .models import User, OAuthGrant, OAuthSessionGrant


def is_admin_claims(claims):
    email = str(claims.get("email") or "").lower()
    if claims.get("email_verified") is True and email in settings.admin_emails:
        return True
    roles = claims.get("roles") or []
    return isinstance(roles, list) and "admin" in roles


def upsert_user(db, claims):
    return upsert_standard_user(db, User, claims, is_admin_claims)


def revoke_delegated_access(db, session_ids):
    grant_ids = select(OAuthSessionGrant.grant_id).where(OAuthSessionGrant.session_id.in_(session_ids))
    db.execute(update(OAuthGrant).where(OAuthGrant.id.in_(grant_ids)).values(revoked=True))


manager = AuthManager(AuthConfig.from_settings(settings), base=Base, get_db=get_db,
                      user_model=User, upsert_user=upsert_user, on_revoke=revoke_delegated_access)
router = manager.router
current_user = manager.current_user
require_user = manager.require_user
require_admin = manager.require_admin
