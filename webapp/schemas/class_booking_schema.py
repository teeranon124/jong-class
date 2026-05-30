from pydantic import BaseModel, BeforeValidator, ConfigDict, PlainSerializer, field_serializer, Field
from typing import List, Dict, Optional, Annotated, Any
from beanie import PydanticObjectId
from datetime import datetime

def convert_to_objectid(v: Any) -> Any:
    if isinstance(v, PydanticObjectId):
        return v
    if not isinstance(v, str) or not v:
        return v
    try:
        return PydanticObjectId(v)
    except Exception:
        # If it's not a valid ObjectId, return as-is (e.g. email or placeholder)
        # Beanie/Pydantic will handle specific type errors later if needed
        return v

PyObjectId = Annotated[
    Any, 
    BeforeValidator(convert_to_objectid),
    PlainSerializer(lambda v: str(v), return_type=str)
]

class ScheduleSchema(BaseModel):
    date: datetime
    time: str

class ClassSchema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = None
    title: str
    openDate: datetime
    closeDate: datetime
    price: float
    maxSeats: int
    bookedSeats: int = 0
    status: str = "open"
    schedules: List[ScheduleSchema] = []
    tutorId: Optional[PyObjectId] = None
    tutorName: Optional[str] = None
    instituteName: Optional[str] = None

def serialize_datetime(v: datetime) -> str:
    if v is None: return None
    # Ensure 'Z' is appended if timezone is UTC to help frontend parsers
    return v.isoformat().replace('+00:00', 'Z')

class BookingSchema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = None
    classId: PyObjectId
    studentId: PyObjectId
    studentName: str
    status: str = "pending"
    created_date: Optional[datetime] = Field(default=None)
    updated_date: Optional[datetime] = Field(default=None)
    slipUrl: Optional[str] = None
    
    @field_serializer('created_date', 'updated_date')
    def serialize_dt(self, v: datetime, _info):
        if v is None: return None
        return v.isoformat().replace('+00:00', 'Z')

class BookingStatusUpdate(BaseModel):
    status: str

class BookingSlipUpdate(BaseModel):
    slipUrl: str

class SettingsSchema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    name: str
    bankName: str
    accountName: str
    accountNumber: str
    auto_accept_followers: bool = True
    payment_timeout_minutes: int = 5

class AttendanceToggleSchema(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    classId: PyObjectId
    schIndex: int
    studentId: PyObjectId
