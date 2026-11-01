"""
WBS 3.2.2 | Role: [Lead Dev / Backend]
Pydantic-схемы для авторизации.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        # Issue: Email должен быть регистронезависимым
        return v.lower()


class UserCreate(UserBase):
    """Данные регистрации (UC-01)."""
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_not_whitespace(cls, v: str) -> str:
        # Issue #5: Запрещаем пароли из одних пробелов
        if not v.strip():
            raise ValueError("Пароль не может состоять только из пробелов")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "UserCreate":
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


class UserRead(UserBase):
    id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        # Issue: Email должен быть регистронезависимым
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole