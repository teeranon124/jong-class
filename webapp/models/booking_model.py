from beanie import Document, PydanticObjectId
from typing import Optional, Union
from pydantic import Field
from datetime import datetime, timezone

class Booking(Document):
    classId: PydanticObjectId
    studentId: PydanticObjectId
    studentName: str
    status: str = "pending"
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    slipUrl: Optional[str] = None

    class Settings:
        name = "bookings"
        indexes = [
            "classId",
            "studentId",
            "status"
        ]
