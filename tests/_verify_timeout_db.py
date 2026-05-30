import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from beanie import PydanticObjectId
from webapp.core.config import settings
from webapp.models.user_model import User
from webapp.models.class_model import Class
from webapp.models.booking_model import Booking


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    await client.admin.command('ping')
    await init_beanie(database=client[settings.MONGODB_DB], document_models=[User, Class, Booking])
    booking = await Booking.find_one(Booking.id == PydanticObjectId('6a1a8a63c43c4574c570f23c'))
    cls = await Class.find_one(Class.id == PydanticObjectId('6a1a85940026498136e77168'))
    bookings_for_class = await Booking.find(Booking.classId == PydanticObjectId('6a1a85940026498136e77168')).to_list()
    print({
        'booking_status': booking.status if booking else None,
        'booking_updated': booking.updated_date.isoformat() if booking and booking.updated_date else None,
        'class_bookedSeats': cls.bookedSeats if cls else None,
        'class_status': cls.status if cls else None,
        'bookings_for_class': [
            {
                'id': str(item.id),
                'status': item.status,
                'studentName': item.studentName,
                'created_date': item.created_date.isoformat() if item.created_date else None,
                'updated_date': item.updated_date.isoformat() if item.updated_date else None,
            }
            for item in bookings_for_class
        ],
    })


if __name__ == '__main__':
    asyncio.run(main())
