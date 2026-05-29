from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ..models import init_db
from .routers.user import router as user_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    await init_db()
    yield
    # Shutdown actions (if any)

def create_app() -> FastAPI:
    app = FastAPI(
        title="TutorBooking API",
        version="1.0.0",
        lifespan=lifespan
    )

    # CORS configuration to accept requests from frontend origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Restrict to Vercel/local domain in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API Routers
    app.include_router(user_router, prefix="/api")

    return app
