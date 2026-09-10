"""全部配置来自环境变量。值不在这里写死，密钥更不进代码。"""
import os
from dataclasses import dataclass, field


def _env(k: str, d: str = "") -> str:
    return os.environ.get(k, d)


def _list(k: str) -> list[str]:
    return [x.strip() for x in _env(k).split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "bide"
    base_url: str = _env("BASE_URL", "https://bide.example.com").rstrip("/")
    data_dir: str = _env("DATA_DIR", "/data")
    db_url: str = _env("DATABASE_URL", "")
    port: int = int(_env("PORT", "8080"))

    # 会话
    session_secret: str = _env("SESSION_SECRET", "")
    session_ttl: int = max(3600, int(float(_env("SESSION_TTL_DAYS", "30")) * 86400))
    cookie_name: str = _env("COOKIE_NAME", "bide_session")

    # OIDC（Logto 或任何标准 OIDC 提供方）
    oidc_issuer: str = _env("OIDC_ISSUER", "").rstrip("/")
    oidc_client_id: str = _env("OIDC_CLIENT_ID", "")
    oidc_client_secret: str = _env("OIDC_CLIENT_SECRET", "")
    oidc_scopes: str = _env("OIDC_SCOPES", "openid profile email offline_access")
    oidc_account_center: str = _env("OIDC_ACCOUNT_CENTER", "")
    admin_emails: frozenset = field(default_factory=lambda: frozenset(e.lower() for e in _list("ADMIN_EMAILS")))
    dev_login: bool = _env("DEV_LOGIN", "") == "1"

    # 行情服务
    quant_base: str = _env("QUANT_BASE", "http://quant:8080").rstrip("/")
    quant_public_base: str = _env("QUANT_PUBLIC_BASE", "https://quant.bide.example.com").rstrip("/")
    quant_api_key: str = _env("QUANT_API_KEY", "")

    # grok agent
    agent_url: str = _env("AGENT_URL", "").rstrip("/")
    agent_secret: str = _env("AGENT_SECRET", "")

    # 邮件（直连 SMTP）
    smtp_host: str = _env("SMTP_HOST", "smtp.163.com")
    smtp_port: int = int(_env("SMTP_PORT", "465"))
    smtp_user: str = _env("SMTP_USER", "")
    smtp_pass: str = _env("SMTP_PASS", "")
    mail_from: str = _env("MAIL_FROM", "") or _env("SMTP_USER", "")
    notify_to: list = field(default_factory=lambda: _list("NOTIFY_TO"))
    notify_skip: frozenset = field(default_factory=lambda: frozenset(e.lower() for e in _list("NOTIFY_SKIP")))
    notify_gap_min: int = max(0, int(_env("NOTIFY_GAP_MIN", "30")))

    profile_links: tuple = ({"href": "/oauth/connections", "label": "已授权应用", "description": "管理 AI 客户端的访问授权"},)

    # MCP（mcp.bide.example.com）
    mcp_host: str = _env("MCP_HOST", "mcp.bide.example.com")

    # Bitget
    bitget_key: str = _env("BITGET_KEY", "")
    bitget_secret: str = _env("BITGET_SECRET", "")
    bitget_ro_key: str = _env("BITGET_RO_KEY", "")
    bitget_ro_secret: str = _env("BITGET_RO_SECRET", "")
    bg_vault_secret: str = _env("BG_VAULT_SECRET", "")
    bg_max_order_usd: float = float(_env("BG_MAX_ORDER_USD", "60"))

    @property
    def database_url(self) -> str:
        return self.db_url or f"sqlite:///{self.data_dir}/bide.db"

    @property
    def auth_ready(self) -> bool:
        return bool(self.oidc_issuer and self.oidc_client_id and self.oidc_client_secret)

    @property
    def redirect_uri(self) -> str:
        return self.base_url + "/auth/callback"


settings = Settings()
