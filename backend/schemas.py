"""Schémas de validation des formulaires."""

from pydantic import BaseModel, Field, field_validator


class RegisterForm(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=255)
    postal_code: str = Field(min_length=1, max_length=20)
    city: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)
    password_confirm: str = Field(min_length=1, max_length=128)
    demo_ack: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("first_name", "last_name", "phone", "address", "postal_code", "city")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Champ obligatoire")
        return cleaned
