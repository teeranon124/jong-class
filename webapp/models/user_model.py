from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class User(Document):
    username: str = Field(..., unique=True)
    password: str
    status: str = "active"
    created_date: datetime = Field(default_factory=datetime.now)
    updated_date: datetime = Field(default_factory=datetime.now)
    last_login_date: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = ["username"]
