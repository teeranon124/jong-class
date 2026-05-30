from beanie import Document, PydanticObjectId
from typing import Optional, Union
from pydantic import Field

class Attendance(Document):
    classId: PydanticObjectId
    schIndex: int
    studentId: PydanticObjectId

    class Settings:
        name = "attendance"
        indexes = [
            "classId",
            "studentId",
            ["classId", "schIndex", "studentId"]
        ]
