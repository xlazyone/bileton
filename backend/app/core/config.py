from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения (переменные окружения и backend/.env)."""

    app_name: str = "БилетON API"
    api_v1_prefix: str = "/api"
    debug: bool = False

    # Пример: postgresql+psycopg://bileton:bileton@localhost:5432/bileton
    database_url: str = "postgresql+psycopg://bileton:bileton@localhost:5432/bileton"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
