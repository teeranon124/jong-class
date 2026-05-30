import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId
from webapp.core.config import settings
from webapp.models.user_model import User
from webapp.models.class_model import Class
from webapp.models.booking_model import Booking


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    await client.admin.command('ping')
    await init_beanie(database=client[settings.MONGODB_DB], document_models=[User, Class, Booking])
    cls = await Class.find_one(Class.id == PydanticObjectId('6a1a85940026498136e77168'))
    bookings = await Booking.find(Booking.classId == PydanticObjectId('6a1a85940026498136e77168')).to_list()
    active = [b for b in bookings if b.status in {'pending', 'checking', 'approved'}]
    timeout = [b for b in bookings if b.status == 'timeout']
    print({
        'class_bookedSeats': cls.bookedSeats if cls else None,
        'class_status': cls.status if cls else None,
        'active_booking_count': len(active),
        'timeout_booking_count': len(timeout),
        'timeout_ids': [str(b.id) for b in timeout],
    })


if __name__ == '__main__':
    asyncio.run(main())
