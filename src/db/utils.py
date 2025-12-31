import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

load_dotenv()

POSTGRES_CONNECTION_STRING = os.getenv("POSTGRES_CONNECTION_STRING")

if not POSTGRES_CONNECTION_STRING:
    raise ValueError("POSTGRES_CONNECTION_STRING environment variable is not set")

ASYNC_DATABASE_URL = POSTGRES_CONNECTION_STRING.replace(
    "postgresql://", "postgresql+asyncpg://"
)

_engine = None
_session_factory = None


def get_async_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)
    return _engine


def get_async_session() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory
