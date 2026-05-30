# Implementation Plan - Refactoring Flask Starter to FastAPI

This document outlines the step-by-step technical plan to refactor the legacy Flask-based `flask-starter` codebase into a modern, asynchronous FastAPI application. It is designed to follow modern backend standards (API-First architecture), utilizing Pydantic for validation, Beanie as the asynchronous MongoDB ODM, and JWT-based stateless authentication.

---

## Proposed Architectural Overview

The refactored FastAPI project will transition to an **API-First Architecture** with the following layered structure:

```text
webapp/
├── cmd/
│   └── web.py                # ASGI launcher using Uvicorn
├── core/
│   ├── config.py             # Environment configuration via pydantic-settings
│   └── security.py           # Password hashing (passlib/bcrypt) and JWT helpers
├── models/
│   ├── __init__.py           # MongoDB connection & Beanie initialization (Lifespan events)
│   └── user_model.py         # Async DB document model via Beanie Document
├── schemas/                  # Pydantic schemas replacing legacy WTForms
│   └── user_schema.py        # Request/Response schemas (UserCreate, UserLogin, UserResponse)
├── services/
│   └── user_service.py       # Async Business Logic layer
└── web/
    ├── __init__.py           # FastAPI app factory (Middlewares, CORS, Lifespan setup)
    └── routers/              # APIRouter definitions replacing Flask Blueprints
        ├── __init__.py       # Router registrations
        ├── index.py          # HTML view renderer (if SSR is needed)
        └── user.py           # User authentication endpoints (JSON API / HTML)
```

---

## Proposed Changes

We will group our refactoring steps into the following logical components:

### 1. Dependencies and Environment Settings

#### [MODIFY] [pyproject.toml](file:///C:/flask-starter/pyproject.toml)
Replace the legacy Flask dependencies with the modern FastAPI async stack.

```toml
[tool.poetry.dependencies]
python = ">=3.13,<4.0"
fastapi = "^0.111.0"
uvicorn = { extras = ["standard"], version = "^0.30.1" }
pydantic = "^2.7.4"
pydantic-settings = "^2.3.3"
beanie = "^1.26.0"
motor = "^3.5.1"
passlib = { extras = ["bcrypt"], version = "^1.7.4" }
python-jose = { extras = ["cryptography"], version = "^3.3.0" }
python-multipart = "^0.0.9"
```

#### [NEW] [config.py](file:///C:/flask-starter/webapp/core/config.py)
Create a centralized, type-safe settings class using Pydantic Settings.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DEBUG: bool = True
    SECRET_KEY: str = "changethisonproduction"
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "appdb"
    APP_TITLE: str = "TutorBooking API"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

---

### 2. Database & Models Layer

We will transition from the synchronous `flask-mongoengine` to **Beanie**, an asynchronous Python ODM built on top of `Motor` and `Pydantic`.

#### [MODIFY] [__init__.py](file:///C:/flask-starter/webapp/models/__init__.py)
Refactor DB initialization to support asynchronous lifespan operations.

```python
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
```

#### [MODIFY] [user_model.py](file:///C:/flask-starter/webapp/models/user_model.py)
Convert the User model into an async Beanie Document, separating password checking/hashing utilities into `core/security.py` to maintain the Single Responsibility Principle.

```python
from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class User(Document):
    username: str = Field(..., unique=True)
    password: str
    status: str = "active"
    created_date: datetime = Field(default_factory=datetime.now)
    updated_date: datetime = Field(default_factory=datetime.now)
    last_login_date: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = ["username"]
```

---

### 3. Schemas Layer (Pydantic Data Validation)

We will remove the Flask-WTF / WTForms library entirely and use Pydantic models to parse and validate HTTP requests (JSON/Form payloads) and sanitize responses.

#### [NEW] [user_schema.py](file:///C:/flask-starter/webapp/schemas/user_schema.py)
Define validation structures for requests and standardized API responses.

```python
from pydantic import BaseModel, Field

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    confirm_password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    status: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

---

### 4. Security & Core Helpers

#### [NEW] [security.py](file:///C:/flask-starter/webapp/core/security.py)
Provide helpers for password hashing (bcrypt), stateless JWT generation/validation, and **dependency-based API protection (Gatekeepers)**.

```python
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from ..core.config import settings
from ..models.user_model import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme specifying where to obtain the token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

# Gatekeeper Dependency: Extract token, decode it, and check user validity
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถยืนยันตัวตนได้ หรือ Token หมดอายุ",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await User.find_one(User.username == username)
    if user is None:
        raise credentials_exception
    return user

# Gatekeeper Dependency: Enforce active status
async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="บัญชีผู้ใช้นี้ไม่พร้อมใช้งาน"
        )
    return current_user
```


---

### 5. Services Layer (Async Business Logic)

#### [MODIFY] [user_service.py](file:///C:/flask-starter/webapp/services/user_service.py)
Rewrite authentication and registration methods to leverage async calls to MongoDB via Beanie and use standard security helpers.

```python
from ..models.user_model import User
from ..schemas.user_schema import UserRegister
from ..core.security import verify_password, get_password_hash, create_access_token
from datetime import datetime

class UserService:
    @staticmethod
    async def login(username: str, password: str) -> dict:
        user = await User.find_one(User.username == username)
        if not user or not verify_password(password, user.password):
            return {"success": False, "error_msg": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}
        
        if user.status == "disactive":
            return {"success": False, "error_msg": "บัญชีของท่านถูกลบออกจากระบบ"}
        
        # Update login date asynchronously
        user.last_login_date = datetime.now()
        await user.save()
        
        token = create_access_token(data={"sub": user.username, "id": str(user.id)})
        return {"success": True, "access_token": token, "user": user}

    @staticmethod
    async def register(schema: UserRegister) -> dict:
        existing_user = await User.find_one(User.username == schema.username)
        if existing_user:
            return {"success": False, "error_msg": "ชื่อผู้ใช้ซ้ำ"}

        if schema.password != schema.confirm_password:
            return {"success": False, "error_msg": "รหัสผ่านไม่ตรงกัน"}

        hashed_password = get_password_hash(schema.password)
        new_user = User(
            username=schema.username,
            password=hashed_password
        )
        await new_user.insert()
        return {"success": True, "user": new_user}
```

---

### 6. Routers Layer (API Endpoints)

We will deprecate the old Flask Blueprints in `web/views/` and replace them with FastAPI **APIRouters** inside `web/routers/`. To support the external HTML integration (or API-First concept), the endpoints will return standard JSON responses and receive payloads via Pydantic or Forms.

#### [NEW] [user.py](file:///C:/flask-starter/webapp/web/routers/user.py)
Provide registration, authentication, and protected query APIs (using the Gatekeeper Dependency).

```python
from fastapi import APIRouter, HTTPException, status, Depends
from ...schemas.user_schema import UserRegister, UserLogin, Token, UserResponse
from ...services.user_service import UserService
from ...core.security import get_current_active_user
from ...models.user_model import User

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=UserResponse)
async def register(payload: UserRegister):
    result = await UserService.register(payload)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error_msg"]
        )
    return result["user"]

@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    result = await UserService.login(payload.username, payload.password)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error_msg"]
        )
    return {"access_token": result["access_token"], "token_type": "bearer"}

# Protected Endpoint Example (Only accessible by authenticated, active users)
@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_active_user)):
    return current_user
```


---

### 7. App Lifecycle, Middlewares & App Launcher

#### [MODIFY] [__init__.py](file:///C:/flask-starter/webapp/web/__init__.py)
Refactor the app creation using a `contextmanager` lifespan to setup Beanie DB connections and configure CORS middleware (enabling access from the frontend, e.g., Vercel or locally served pages).

```python
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
```

#### [MODIFY] [web.py](file:///C:/flask-starter/webapp/cmd/web.py)
Update launcher script to run the ASGI application using `uvicorn`.

```python
import uvicorn
from ...core.config import settings

def main():
    uvicorn.run(
        "webapp.web:create_app",
        host="127.0.0.1",
        port=8080,
        reload=settings.DEBUG,
        factory=True
    )
```

---

## Verification Plan

### Automated Verification
1. Run local environment setup:
   ```bash
   poetry install
   ```
2. Start the local server:
   ```bash
   poetry run run-web
   ```
3. Test endpoints using the interactive documentation:
   - Navigate to `http://127.0.0.1:8080/docs` (Swagger UI) to test login and registration endpoints.
   - Run sample requests to ensure Pydantic validations (e.g., minimum password length) return clean HTTP 422 errors instead of breaking.

### Manual Verification
1. Integration check with `tutorbooking_system.html`:
   - Host `tutorbooking_system.html` in the browser.
   - Use `fetch` requests inside the Javascript to call `http://127.0.0.1:8080/api/users/register` and `http://127.0.0.1:8080/api/users/login`.
   - Store the returned `access_token` in `localStorage` and ensure subsequent requests include it in headers as `Authorization: Bearer <token>`.
