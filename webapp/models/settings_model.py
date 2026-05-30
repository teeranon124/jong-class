from beanie import Document, PydanticObjectId
from typing import Optional, Union
from pydantic import Field

class Settings(Document):
    tutorId: Optional[PydanticObjectId] = None
    name: str = ""
    bankName: str = ""
    accountName: str = ""
    accountNumber: str = ""
    auto_accept_followers: bool = True
    payment_timeout_minutes: int = 5

    class Settings:
        name = "settings"
        indexes = [
            "tutorId"
        ]
