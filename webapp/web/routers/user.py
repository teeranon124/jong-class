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
