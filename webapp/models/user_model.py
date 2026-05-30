from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional, List
import random
import string

def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

class User(Document):
    email: str = Field(..., unique=True)
    password: str
    name: Optional[str] = None
    role: str = "student"
    status: str = "active"
    subscription_plan: str = "ทดลองใช้ฟรี"
    subscription_days_left: int = 14
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_date: Optional[datetime] = None
    linked_tutor_id: Optional[PydanticObjectId] = None
    avatar_url: Optional[str] = None
    invite_code: str = Field(default_factory=generate_invite_code)
    following_tutors: List[PydanticObjectId] = []
    pending_tutors: List[PydanticObjectId] = []

    class Settings:
        name = "users"
        indexes = ["email"]
