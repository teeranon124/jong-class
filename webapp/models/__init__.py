from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from ..core.config import settings
from .user_model import User

async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB],
        document_models=[User]
    )
