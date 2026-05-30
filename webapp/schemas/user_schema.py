from pydantic import BaseModel, Field, BeforeValidator, PlainSerializer
from typing import Optional, Annotated, List, Any


def convert_to_str(v: Any) -> str:
    return str(v) if v else v


PyObjectId = Annotated[
    str,
    BeforeValidator(convert_to_str),
    PlainSerializer(lambda v: str(v), return_type=str),
]


class UserRegister(BaseModel):
    email: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    confirm_password: str
    role: Optional[str] = "student"
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str
    role: Optional[str] = None


class UserResponse(BaseModel):
    id: PyObjectId
    email: str
    name: Optional[str] = None
    role: str
    status: str
    subscription_plan: str
    subscription_days_left: int
    linked_tutor_id: Optional[PyObjectId] = None
    avatar_url: Optional[str] = None
    invite_code: Optional[str] = None
    following_tutors: List[PyObjectId] = []

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=6)
    confirm_password: Optional[str] = None
    name: Optional[str] = None
    subscription_plan: Optional[str] = None
    subscription_days_left: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SubscriptionUpgrade(BaseModel):
    plan: str


class FollowRequest(BaseModel):
    invite_code: str
