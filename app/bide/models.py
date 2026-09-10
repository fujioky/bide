"""数据模型。旧系统是 /data 下按用户一个 JSON 文件，这里全部进表；
正文类的大块内容（保险箱密文、审计日志）也进表，备份只需拷一个 .db。"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    """sub 是 OIDC 提供方给的稳定主体；从旧系统迁来的用户先只有 email，
    第一次登录时按 email 认领、把 sub 补上。"""
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sub: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    avatar: Mapped[str] = mapped_column(String(600), default="")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 旧系统里的键（组织/账号名），迁移时留着方便对照
    legacy_uid: Mapped[str | None] = mapped_column(String(200), nullable=True)


class UserList(Base):
    """按用户存的代码列表：kind = watch（关注）/ flag（星标）。"""
    __tablename__ = "user_lists"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    symbols: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Order(Base):
    """手工录入的订单流水。持仓与均价由前端从流水算。"""
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sym: Mapped[str] = mapped_column(String(12))
    side: Mapped[str] = mapped_column(String(4))
    date: Mapped[str] = mapped_column(String(10))
    qty: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(String(80), default="")
    at: Mapped[int] = mapped_column(Integer)  # 毫秒时间戳，沿用旧字段


class Read(Base):
    """今日关注的已读标记：{代码: 'YYYY-MM-DD'}，只有等于今天才算已读。"""
    __tablename__ = "reads"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    reads: Mapped[dict] = mapped_column(JSON, default=dict)


class MarketMeta(Base):
    """市场元数据：kind = names / analyst / tags / earnings，data 是原来 JSON 文件里那条记录。"""
    __tablename__ = "market_meta"
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    sym: Mapped[str] = mapped_column(String(12), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class KV(Base):
    """零散状态：market.lastDaily、bg.vault、bg.last_probe、notify.stats 之类。"""
    __tablename__ = "kv"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)


class Audit(Base):
    """Bitget 下单审计：成功失败都记。"""
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    kind: Mapped[str] = mapped_column(String(24), default="bg_order")
    rec: Mapped[dict] = mapped_column(JSON, default=dict)


class Visit(Base):
    """通知模块的每用户状态：首次/累计/上次打开、上次发信、最近在线。"""
    __tablename__ = "visits"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    first: Mapped[int] = mapped_column(Integer, default=0)
    count: Mapped[int] = mapped_column(Integer, default=0)
    last: Mapped[int] = mapped_column(Integer, default=0)
    last_mail: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[int] = mapped_column(Integer, default=0)
    url: Mapped[str] = mapped_column(String(200), default="")
    reg_mailed: Mapped[int] = mapped_column(Integer, default=0)


class OAuthClient(Base):
    """MCP OAuth clients registered locally, independent of Logto applications."""
    __tablename__ = "oauth_clients"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    redirects: Mapped[list] = mapped_column(JSON)
    auth_method: Mapped[str] = mapped_column(String(30))
    secret_hash: Mapped[str] = mapped_column(String(64), default="")
    created: Mapped[int] = mapped_column(Integer)


class OAuthRequest(Base):
    __tablename__ = "oauth_requests"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("oauth_clients.id", ondelete="CASCADE"))
    params: Mapped[dict] = mapped_column(JSON)
    expires: Mapped[int] = mapped_column(Integer, index=True)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class OAuthGrant(Base):
    __tablename__ = "oauth_grants"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("oauth_clients.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scope: Mapped[str] = mapped_column(String(100))
    resource: Mapped[str] = mapped_column(String(300))
    created: Mapped[int] = mapped_column(Integer)
    expires: Mapped[int] = mapped_column(Integer)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class OAuthCredential(Base):
    """Only SHA256 digests of high entropy codes/tokens are persisted."""
    __tablename__ = "oauth_credentials"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    grant_id: Mapped[str] = mapped_column(ForeignKey("oauth_grants.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    expires: Mapped[int] = mapped_column(Integer, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    redirect_uri: Mapped[str] = mapped_column(String(2000), default="")
    challenge: Mapped[str] = mapped_column(String(100), default="")


class OAuthSessionGrant(Base):
    """App-specific link: explicitly logging out a device revokes its MCP grants."""
    __tablename__ = "oauth_session_grants"
    grant_id: Mapped[str] = mapped_column(ForeignKey("oauth_grants.id", ondelete="CASCADE"), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("auth_sessions.id", ondelete="CASCADE"), index=True)
