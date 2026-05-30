from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from ..core.config import settings
from .user_model import User
from .class_model import Class
from .booking_model import Booking
from .settings_model import Settings
from .attendance_model import Attendance

async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB],
        document_models=[User, Class, Booking, Settings, Attendance]
    )
