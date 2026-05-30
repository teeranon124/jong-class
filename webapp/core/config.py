from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DEBUG: bool = True
    SECRET_KEY: str = "changethisonproduction"
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "appdb"
    APP_TITLE: str = "TutorBooking API"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    GOOGLE_CLIENT_ID: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
