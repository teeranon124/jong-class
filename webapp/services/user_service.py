from typing import Optional

from ..models.user_model import User
from ..schemas.user_schema import UserRegister
from ..core.security import verify_password, get_password_hash, create_access_token
from datetime import datetime, timezone


class UserService:
    @staticmethod
    async def login(email: str, password: str, role: Optional[str] = None) -> dict:
        user = await User.find_one(User.email == email)
        if not user or not verify_password(password, user.password):
            return {"success": False, "error_msg": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}

        if role and user.role != role:
            return {"success": False, "error_msg": "บัญชีนี้ไม่ตรงกับโหมดที่เลือก"}

        if user.status == "disactive":
            return {"success": False, "error_msg": "บัญชีของท่านถูกลบออกจากระบบ"}

        # Update login date asynchronously
        user.last_login_date = datetime.now(timezone.utc)
        await user.save()

        token = create_access_token(data={"sub": user.email, "id": str(user.id)})
        return {"success": True, "access_token": token, "user": user}

    @staticmethod
    async def register(schema: UserRegister) -> dict:
        existing_user = await User.find_one(User.email == schema.email)
        if existing_user:
            return {"success": False, "error_msg": "อีเมลนี้ถูกใช้งานแล้ว"}

        if schema.password != schema.confirm_password:
            return {"success": False, "error_msg": "รหัสผ่านไม่ตรงกัน"}

        hashed_password = get_password_hash(schema.password)
        new_user = User(
            email=schema.email,
            password=hashed_password,
            role=schema.role or "student",
            name=schema.name or schema.email,
        )
        await new_user.insert()
        return {"success": True, "user": new_user}

    @staticmethod
    async def update_profile(user: User, schema) -> dict:
        if schema.email and schema.email != user.email:
            existing = await User.find_one(User.email == schema.email)
            if existing:
                return {"success": False, "error_msg": "อีเมลนี้ถูกใช้งานแล้ว"}
            user.email = schema.email

        if schema.name is not None:
            user.name = schema.name

        if schema.password:
            if schema.password != schema.confirm_password:
                return {"success": False, "error_msg": "รหัสผ่านไม่ตรงกัน"}
            user.password = get_password_hash(schema.password)

        user.updated_date = datetime.now(timezone.utc)
        await user.save()
        return {"success": True, "user": user}
