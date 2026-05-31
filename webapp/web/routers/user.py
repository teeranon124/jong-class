from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from ...schemas.user_schema import (
    UserRegister,
    UserLogin,
    Token,
    UserResponse,
    UserUpdate,
    SubscriptionUpgrade,
    FollowRequest,
)
from ...services.user_service import UserService
from ...core.security import (
    get_current_active_user,
    create_access_token,
    get_password_hash,
)
from ...models.user_model import User
from beanie import PydanticObjectId
from beanie.operators import In

router = APIRouter(prefix="/users", tags=["Users"])


from ...core.config import settings
import httpx
import random
import string


class GoogleLoginRequest(BaseModel):
    id_token: str
    role: str = "student"


@router.get("/auth/config")
async def get_auth_config():
    return {"google_client_id": settings.GOOGLE_CLIENT_ID}


@router.post("/login/google", response_model=Token)
async def login_google(payload: GoogleLoginRequest):
    # 1. Validate ID token with Google API
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.id_token}"
        )
        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Token ไม่ถูกต้อง หรือหมดอายุ",
            )
        id_info = res.json()

    email = id_info.get("email")
    name = id_info.get("name")
    picture = id_info.get("picture")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่พบอีเมลในบัญชี Google",
        )

    # 2. Query/Register user
    requested_role = payload.role or "student"
    
    user = await User.find_one(User.email == email)
    if not user:
        # Generate random password (unused since they log in via Google)
        random_pass = "".join(
            random.choices(string.ascii_letters + string.digits, k=16)
        )
        user = User(
            email=email,
            password=get_password_hash(random_pass),
            role=requested_role,
            name=name or email,
            status="active",
            avatar_url=picture,
        )
        await user.insert()
    else:
        if user.status == "disactive":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="บัญชีนี้ถูกระงับการใช้งาน",
            )
        # Update name and avatar if they changed on Google
        user.name = name or user.name
        if picture:
            user.avatar_url = picture
        await user.save()
        
        # Auto route to student shadow account if a tutor logs in as student
        if user.role == "admin" and requested_role == "student":
            shadow_email = f"student_{user.email}"
            shadow_user = await User.find_one(
                User.email == shadow_email, User.linked_tutor_id == user.id
            )
            
            if not shadow_user:
                random_pass = "".join(
                    random.choices(string.ascii_letters + string.digits, k=32)
                )
                shadow_user = User(
                    email=shadow_email,
                    password=get_password_hash(random_pass),
                    role="student",
                    name=f"{user.name} (นักเรียน)",
                    linked_tutor_id=user.id,
                    avatar_url=user.avatar_url,
                )
                await shadow_user.insert()
            else:
                if picture:
                    shadow_user.avatar_url = picture
                    await shadow_user.save()
            
            # Switch target login user to shadow account
            user = shadow_user
            
        elif user.role == "student" and requested_role == "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="อีเมลนี้ลงทะเบียนเป็นบัญชีนักเรียนทั่วไปไว้แล้ว หากต้องการเป็นติวเตอร์กรุณาใช้อีเมลอื่น หรือติดต่อผู้ดูแลระบบครับ",
            )

    # 3. Issue native JWT
    access_token = create_access_token(
        data={"sub": user.email, "id": str(user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}



@router.post("/follow")
async def follow_tutor(
    payload: FollowRequest, current_user: User = Depends(get_current_active_user)
):
    if current_user.role == "admin":
        raise HTTPException(
            status_code=400, detail="ติวเตอร์ไม่สามารถติดตามติวเตอร์อื่นได้"
        )

    tutor = await User.find_one(
        User.invite_code == payload.invite_code.upper(), User.role == "admin"
    )
    if not tutor:
        raise HTTPException(
            status_code=404, detail="ไม่พบรหัสเชิญนี้ หรือรหัสไม่ถูกต้อง"
        )

    if tutor.id in current_user.following_tutors:
        return {
            "success": True,
            "message": "คุณติดตามติวเตอร์ท่านนี้อยู่แล้ว",
            "tutor_name": tutor.name,
        }

    if tutor.id in current_user.pending_tutors:
        return {
            "success": True,
            "message": "อยู่ระหว่างรอติวเตอร์ตอบรับการติดตาม",
            "tutor_name": tutor.name,
        }

    # Check tutor settings for auto-accept
    from ...models.settings_model import Settings

    tutor_settings = await Settings.find_one(Settings.tutorId == tutor.id)
    auto_accept = tutor_settings.auto_accept_followers if tutor_settings else True

    if auto_accept:
        current_user.following_tutors.append(tutor.id)
        msg = f"ติดตาม {tutor.name} เรียบร้อยแล้ว"
    else:
        current_user.pending_tutors.append(tutor.id)
        msg = f"ส่งคำขอติดตาม {tutor.name} เรียบร้อยแล้ว (รอการยืนยัน)"

    await current_user.save()
    return {
        "success": True,
        "message": msg,
        "tutor_name": tutor.name,
        "auto_accepted": auto_accept,
    }


@router.post("/unfollow")
async def unfollow_tutor(
    payload: FollowRequest, current_user: User = Depends(get_current_active_user)
):
    if current_user.role == "admin":
        raise HTTPException(
            status_code=400, detail="ติวเตอร์ไม่สามารถเลิกติดตามติวเตอร์อื่นได้"
        )

    tutor = await User.find_one(
        User.invite_code == payload.invite_code.upper(), User.role == "admin"
    )
    if not tutor:
        raise HTTPException(
            status_code=404, detail="ไม่พบรหัสเชิญนี้ หรือรหัสไม่ถูกต้อง"
        )

    changed = False
    if tutor.id in current_user.following_tutors:
        current_user.following_tutors.remove(tutor.id)
        changed = True
    if tutor.id in current_user.pending_tutors:
        current_user.pending_tutors.remove(tutor.id)
        changed = True

    if changed:
        await current_user.save()
        return {
            "success": True,
            "message": f"เลิกติดตาม {tutor.name} เรียบร้อยแล้ว",
            "tutor_name": tutor.name,
        }

    return {
        "success": True,
        "message": "ไม่ได้ติดตามติวเตอร์ท่านนี้อยู่แล้ว",
        "tutor_name": tutor.name,
    }


class FollowApprovalRequest(BaseModel):
    student_id: PydanticObjectId


@router.post("/approve-follower")
async def approve_follower(
    payload: FollowApprovalRequest,
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดำเนินการ")

    student = await User.get(payload.student_id)
    if student and current_user.id in student.pending_tutors:
        student.pending_tutors.remove(current_user.id)
        if current_user.id not in student.following_tutors:
            student.following_tutors.append(current_user.id)
        await student.save()
        return {"success": True}
    raise HTTPException(status_code=404, detail="ไม่พบคำขอติดตามนี้")


@router.post("/reject-follower")
async def reject_follower(
    payload: FollowApprovalRequest,
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดำเนินการ")

    student = await User.get(payload.student_id)
    if student and current_user.id in student.pending_tutors:
        student.pending_tutors.remove(current_user.id)
        await student.save()
        return {"success": True}
    raise HTTPException(status_code=404, detail="ไม่พบคำขอติดตามนี้")


@router.post("/remove-follower")
async def remove_follower(
    payload: FollowApprovalRequest,
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดำเนินการ")

    student = await User.get(payload.student_id)
    if student:
        changed = False
        if current_user.id in student.following_tutors:
            student.following_tutors.remove(current_user.id)
            changed = True
        if current_user.id in student.pending_tutors:
            student.pending_tutors.remove(current_user.id)
            changed = True

        if changed:
            await student.save()
            return {"success": True}

    raise HTTPException(status_code=404, detail="ไม่พบลูกศิษย์คนนี้")



@router.get("/network")
async def get_network(current_user: User = Depends(get_current_active_user)):
    if current_user.role == "admin":
        # Get followers (approved)
        followers = await User.find(
            {"following_tutors": {"$in": [current_user.id]}}
        ).to_list()
        # Get requests (pending)
        requests = await User.find(
            {"pending_tutors": {"$in": [current_user.id]}}
        ).to_list()

        return {
            "followers": [
                {"id": str(s.id), "name": s.name, "email": s.email} for s in followers
            ],
            "requests": [
                {"id": str(s.id), "name": s.name, "email": s.email} for s in requests
            ],
        }
    else:
        # Students see following and pending
        following = []
        if current_user.following_tutors:
            tutors = await User.find(
                In(User.id, current_user.following_tutors)
            ).to_list()
            following = [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "email": t.email,
                    "invite_code": t.invite_code,
                    "status": "approved",
                }
                for t in tutors
            ]

        pending = []
        if current_user.pending_tutors:
            tutors_p = await User.find(
                In(User.id, current_user.pending_tutors)
            ).to_list()
            pending = [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "email": t.email,
                    "invite_code": t.invite_code,
                    "status": "pending",
                }
                for t in tutors_p
            ]

        return following + pending


@router.get("/search")
async def search_tutors(
    q: Optional[str] = None, current_user: User = Depends(get_current_active_user)
):
    query = (q or "").strip()
    if not query:
        return []

    tutors = await User.find(
        User.role == "admin",
        User.status == "active",
        {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"invite_code": {"$regex": query, "$options": "i"}},
            ]
        },
    ).to_list()

    results = []
    for tutor in tutors:
        results.append(
            {
                "id": str(tutor.id),
                "name": tutor.name,
                "email": tutor.email,
                "invite_code": tutor.invite_code,
                "is_following": tutor.id in current_user.following_tutors,
                "is_pending": tutor.id in current_user.pending_tutors,
            }
        )
    return results


@router.post("/switch-identity")
async def switch_identity(current_user: User = Depends(get_current_active_user)):
    target_user = None

    if current_user.role == "admin":
        # Case A: Tutor wants to switch to Student
        target_email = f"student_{current_user.email}"
        target_user = await User.find_one(
            User.email == target_email, User.linked_tutor_id == current_user.id
        )

        if not target_user:
            # Create new linked student account
            random_pass = "".join(
                random.choices(string.ascii_letters + string.digits, k=32)
            )
            target_user = User(
                email=target_email,
                password=get_password_hash(random_pass),
                role="student",
                name=f"{current_user.name} (นักเรียน)",
                linked_tutor_id=current_user.id,
                avatar_url=current_user.avatar_url,
            )
            await target_user.insert()

    elif current_user.linked_tutor_id:
        # Case B: Linked Student wants to switch back to Tutor
        target_user = await User.get(current_user.linked_tutor_id)
        if not target_user:
            raise HTTPException(
                status_code=404, detail="ไม่พบรหัสติวเตอร์ที่เชื่อมโยงไว้"
            )
    else:
        # Special case: check if this is a student account that should have been linked
        # This helps recover if linked_tutor_id was missing but email matches the pattern
        if current_user.email.startswith("student_"):
            original_email = current_user.email.replace("student_", "")
            target_user = await User.find_one(
                User.email == original_email, User.role == "admin"
            )
            if target_user:
                # Repair the link
                current_user.linked_tutor_id = target_user.id
                await current_user.save()
            else:
                raise HTTPException(
                    status_code=400,
                    detail="บัญชีนี้ไม่ได้เชื่อมโยงระบบสลับตัวตนอัตโนมัติ",
                )
        else:
            raise HTTPException(
                status_code=400, detail="บัญชีนี้ไม่ได้เชื่อมโยงระบบสลับตัวตนอัตโนมัติ"
            )

    # Keep avatar synced between linked accounts
    if target_user and current_user.avatar_url and target_user.avatar_url != current_user.avatar_url:
        target_user.avatar_url = current_user.avatar_url
        await target_user.save()

    # Issue new token
    access_token = create_access_token(
        data={"sub": target_user.email, "id": str(target_user.id)}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(target_user),
    }


@router.post("/register", response_model=UserResponse)
async def register(payload: UserRegister):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="ระบบยกเลิกการสมัครสมาชิกแบบกรอกอีเมลธรรมดา กรุณาสมัครผ่าน Google เพื่อยืนยันตัวตนจริง"
    )


@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    result = await UserService.login(payload.email, payload.password, payload.role)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error_msg"]
        )
    return {"access_token": result["access_token"], "token_type": "bearer"}


# Protected Endpoint Example (Only accessible by authenticated, active users)
@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserUpdate, current_user: User = Depends(get_current_active_user)
):
    result = await UserService.update_profile(current_user, payload)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error_msg"]
        )
    return result["user"]


@router.put("/me/subscription", response_model=UserResponse)
async def upgrade_subscription(
    payload: SubscriptionUpgrade, current_user: User = Depends(get_current_active_user)
):
    current_user.subscription_plan = payload.plan
    current_user.subscription_days_left = 30
    await current_user.save()
    return current_user
