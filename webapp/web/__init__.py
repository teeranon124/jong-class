from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ..models import init_db
from .routers.user import router as user_router
from .routers.class_booking import (
    router as class_booking_router,
    reject_expired_pending_bookings,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("Lifespan starting...")
    await init_db()
    print("Lifespan initialized DB")

    async def expire_booking_loop():
        # Get Motor database from Beanie to perform raw atomic lock operations
        from ..models.user_model import User
        db = User.get_motor_inherited_database()

        while True:
            try:
                now = datetime.now(timezone.utc)
                expires_at = now + timedelta(seconds=120)
                locked = False
                try:
                    # Atomic distributed lock acquisition
                    await db["locks"].find_one_and_update(
                        {
                            "_id": "expire_bookings_lock",
                            "$or": [
                                {"expires_at": {"$lt": now}},
                                {"expires_at": {"$exists": False}}
                            ]
                        },
                        {
                            "$set": {
                                "acquired_at": now,
                                "expires_at": expires_at
                            }
                        },
                        upsert=True
                    )
                    locked = True
                except Exception:
                    # Duplicate key error indicates another worker holds the lock
                    locked = False

                if locked:
                    updated_count = await reject_expired_pending_bookings()
                    if updated_count:
                        print(f"Expired bookings processed: {updated_count}")

                    # Release the lock immediately after execution
                    await db["locks"].delete_one({"_id": "expire_bookings_lock"})
            except asyncio.CancelledError:
                raise
            except Exception as e:
                print(f"Expired booking sweep error: {e}")
            # Check every 60 seconds (safe now due to database locks)
            await asyncio.sleep(60)

    expiry_task = asyncio.create_task(expire_booking_loop())
    yield
    # Shutdown actions (if any)
    expiry_task.cancel()
    try:
        await expiry_task
    except asyncio.CancelledError:
        pass
    print("Lifespan shutting down...")


def create_app() -> FastAPI:
    app = FastAPI(title="TutorBooking API", version="1.0.0", lifespan=lifespan)

    # CORS configuration to accept requests from frontend origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Restrict to Vercel/local domain in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        response = await call_next(request)
        print(f"Request: {request.method} {request.url.path} -> {response.status_code}")
        return response

    # Include API Routers
    app.include_router(user_router, prefix="/api")
    app.include_router(class_booking_router, prefix="/api")

    return app
