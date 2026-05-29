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
