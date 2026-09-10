"""Validate BIDE-issued MCP access tokens against live user grants.

Opaque access tokens are distinct from login cookies, Logto tokens, codes and
refresh tokens. Every call checks revocation, resource, expiry and user existence.
"""
from ..models import OAuthCredential, OAuthGrant, OAuthSessionGrant, User
from ..routers.mcp_oauth import RESOURCE, SCOPE, digest, now


async def verify_token(token: str, db) -> dict:
    def fail():
        return {"ok": False, "code": 401, "msg": "invalid or expired access token"}
    if not isinstance(token, str) or not token.startswith("bide_access_") or len(token) > 200:
        return fail()
    cred = db.get(OAuthCredential, digest(token))
    if not cred or cred.kind != "access" or cred.used or cred.expires <= now():
        return fail()
    grant = db.get(OAuthGrant, cred.grant_id)
    if (not grant or not db.get(OAuthSessionGrant, grant.id) or grant.revoked or grant.expires <= now() or grant.resource != RESOURCE
            or SCOPE not in grant.scope.split() or not db.get(User, grant.user_id)):
        return fail()
    return {"ok": True, "uid": grant.user_id, "scope": grant.scope}
