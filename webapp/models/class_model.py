from beanie import Document, PydanticObjectId
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class Schedule(BaseModel):
    date: datetime
    time: str

class Class(Document):
    title: str
    openDate: datetime
    closeDate: datetime
    price: float
    maxSeats: int
    bookedSeats: int = 0
    status: str = "open"
    schedules: List[Schedule] = []
    tutorId: Optional[PydanticObjectId] = None

    class Settings:
        name = "classes"
