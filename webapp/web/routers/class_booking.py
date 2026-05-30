from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from ...models.class_model import Class, Schedule
from ...models.booking_model import Booking
from ...models.settings_model import Settings
from ...models.attendance_model import Attendance
from ...schemas.class_booking_schema import (
    ClassSchema,
    BookingSchema,
    BookingStatusUpdate,
    BookingSlipUpdate,
    SettingsSchema,
    AttendanceToggleSchema,
)
from ...core.security import get_current_active_user
from ...models.user_model import User
from beanie import PydanticObjectId
from beanie.operators import In
from datetime import datetime, timezone, timedelta

from ...core.security import (
    get_current_active_user,
    get_current_user,
    oauth2_scheme,
    oauth2_scheme_optional,
)

router = APIRouter(tags=["Classes & Bookings"])


def normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def reject_expired_pending_bookings() -> int:
    """Mark expired pending bookings as timeout and release seats.

    Returns the number of bookings that were updated.
    """
    pending_bookings = await Booking.find(Booking.status == "pending").to_list()
    if not pending_bookings:
        return 0

    now_utc = datetime.now(timezone.utc)
    updated_count = 0

    # 1. Batch fetch classes to prevent N+1 Queries
    class_ids = list({b.classId for b in pending_bookings})
    classes = await Class.find(In(Class.id, class_ids)).to_list()
    class_map = {c.id: c for c in classes}

    # 2. Batch fetch settings to prevent N+1 Queries
    tutor_ids = list({c.tutorId for c in classes if c.tutorId})
    tutor_settings = await Settings.find(In(Settings.tutorId, tutor_ids)).to_list()
    settings_map = {s.tutorId: s for s in tutor_settings}

    for b in pending_bookings:
        cls = class_map.get(b.classId)
        if not cls:
            continue

        t_settings = settings_map.get(cls.tutorId)
        timeout_mins = t_settings.payment_timeout_minutes if t_settings else 5
        expiry_time = normalize_utc(b.created_date) + timedelta(minutes=timeout_mins)

        if now_utc > expiry_time:
            b.status = "timeout"
            b.updated_date = now_utc
            await b.save()
            updated_count += 1

            # Decrement seats atomically in the database to prevent Race Conditions
            updated_cls = await Class.find_one(
                Class.id == cls.id,
                Class.bookedSeats > 0
            ).update({"$inc": {Class.bookedSeats: -1}})

            if updated_cls and updated_cls.modified_count > 0:
                # Reload class to check and sync status safely
                cls_to_sync = await Class.get(cls.id)
                if cls_to_sync and cls_to_sync.bookedSeats < cls_to_sync.maxSeats and cls_to_sync.status != "open":
                    cls_to_sync.status = "open"
                    await cls_to_sync.save()

    return updated_count


async def timeout_booking_if_expired(booking_id: PydanticObjectId) -> bool:
    booking = await Booking.find_one(Booking.id == booking_id)
    if not booking or booking.status != "pending":
        return False

    cls = await Class.find_one(Class.id == booking.classId)
    if not cls:
        return False

    t_settings = await Settings.find_one(Settings.tutorId == cls.tutorId)
    timeout_mins = t_settings.payment_timeout_minutes if t_settings else 5
    expiry_time = normalize_utc(booking.created_date) + timedelta(minutes=timeout_mins)
    now_utc = datetime.now(timezone.utc)

    if now_utc <= expiry_time:
        return False

    booking.status = "timeout"
    booking.updated_date = now_utc
    await booking.save()

    # Decrement seats atomically in the database to prevent Race Conditions
    updated_cls = await Class.find_one(
        Class.id == cls.id,
        Class.bookedSeats > 0
    ).update({"$inc": {Class.bookedSeats: -1}})

    if updated_cls and updated_cls.modified_count > 0:
        # Reload class to check and sync status safely
        cls_to_sync = await Class.get(cls.id)
        if cls_to_sync and cls_to_sync.bookedSeats < cls_to_sync.maxSeats and cls_to_sync.status != "open":
            cls_to_sync.status = "open"
            await cls_to_sync.save()

    return True


@router.get("/classes", response_model=List[ClassSchema])
async def get_public_classes(token: Optional[str] = Depends(oauth2_scheme_optional)):
    try:
        await reject_expired_pending_bookings()
    except Exception as e:
        print(f"Public class sweep error: {e}")

    user = None
    if token:
        try:
            user = await get_current_user(token)
        except:
            pass

    if user and user.role == "student":
        # Students see only classes from tutors they follow
        if not user.following_tutors:
            return []
        return await Class.find(
            In(Class.status, ["open", "full"]), In(Class.tutorId, user.following_tutors)
        ).to_list()

    # Guests see all active classes, including full ones so they can be shown as disabled
    return await Class.find(In(Class.status, ["open", "full"])).to_list()


@router.get("/classes/me", response_model=List[ClassSchema])
async def get_my_classes(current_user: User = Depends(get_current_active_user)):
    try:
        await reject_expired_pending_bookings()
    except Exception as e:
        print(f"My class sweep error: {e}")

    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="เฉพาะอาจารย์ผู้สอนเท่านั้นที่เข้าถึงส่วนนี้ได้"
        )
    # Tutor view: see only their own classes (any status)
    return await Class.find(Class.tutorId == current_user.id).to_list()


@router.post("/classes", response_model=ClassSchema)
async def create_class(
    payload: ClassSchema, current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="เฉพาะอาจารย์ผู้สอนเท่านั้นที่สร้างคอร์สได้"
        )

    # Create class object and manually set schedules to avoid string-parsing issues
    new_class = Class(
        title=payload.title,
        openDate=payload.openDate,
        closeDate=payload.closeDate,
        price=payload.price,
        maxSeats=payload.maxSeats,
        bookedSeats=payload.bookedSeats,
        status=payload.status,
        schedules=[Schedule(date=s.date, time=s.time) for s in payload.schedules],
        tutorId=current_user.id,
    )
    await new_class.insert()
    return new_class


@router.put("/classes/{class_id}", response_model=ClassSchema)
async def update_class(
    class_id: PydanticObjectId,
    payload: ClassSchema,
    current_user: User = Depends(get_current_active_user),
):
    cls = await Class.find_one(Class.id == class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="ไม่พบคอร์สเรียน")

    if cls.tutorId != current_user.id:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์แก้ไขคอร์สของผู้อื่น")

    cls.title = payload.title
    cls.openDate = payload.openDate
    cls.closeDate = payload.closeDate
    cls.schedules = [Schedule(date=s.date, time=s.time) for s in payload.schedules]
    cls.maxSeats = payload.maxSeats
    cls.price = payload.price
    cls.status = payload.status

    await cls.save()
    return cls


@router.get("/bookings", response_model=List[BookingSchema])
async def get_bookings(current_user: User = Depends(get_current_active_user)):
    try:
        await reject_expired_pending_bookings()
    except Exception as e:
        print(f"Auto-reject loop error: {e}")

    if current_user.role == "admin":
        # Tutors see bookings for their classes
        my_classes = await Class.find(Class.tutorId == current_user.id).to_list()
        my_class_ids = [c.id for c in my_classes]
        return await Booking.find(In(Booking.classId, my_class_ids)).to_list()
    else:
        # Students see only their own bookings
        return await Booking.find(Booking.studentId == current_user.id).to_list()


@router.post("/bookings/process-expired")
async def process_expired_bookings(
    current_user: User = Depends(get_current_active_user),
):
    try:
        updated_count = await reject_expired_pending_bookings()
        return {"updated": updated_count}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process expired bookings: {e}"
        )


@router.post("/bookings/{booking_id}/timeout")
async def timeout_booking(
    booking_id: PydanticObjectId,
    current_user: User = Depends(get_current_active_user),
):
    try:
        updated = await timeout_booking_if_expired(booking_id)
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to timeout booking: {e}")


@router.post("/bookings", response_model=BookingSchema)
async def create_booking(
    payload: BookingSchema, current_user: User = Depends(get_current_active_user)
):
    try:
        await reject_expired_pending_bookings()
    except Exception as e:
        print(f"Create booking sweep error: {e}")

    # Security: Ensure students can only book for themselves
    if current_user.role != "student" and not current_user.email.startswith("student_"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="เฉพาะนักเรียนเท่านั้นที่เข้าจองคอร์สเรียนได้"
        )

    # 1. Check for duplicate active bookings
    existing = await Booking.find_one(
        Booking.classId == PydanticObjectId(payload.classId),
        Booking.studentId == current_user.id,
        In(Booking.status, ["pending", "checking", "approved"]),
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="คุณได้จองคอร์สนี้ไปแล้ว และรายการยังคงมีผลอยู่"
        )

    # 2. Check class existence
    class_id = PydanticObjectId(payload.classId)
    cls = await Class.find_one(Class.id == class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="ไม่พบคอร์สเรียน")

    # 3. Update seats atomically (TOCTOU / Race Condition resolution)
    # Increment bookedSeats by 1 only if bookedSeats < maxSeats
    updated_cls = await Class.find_one(
        Class.id == class_id,
        {"$expr": {"$lt": ["$bookedSeats", "$maxSeats"]}}
    ).update({"$inc": {Class.bookedSeats: 1}})

    if not updated_cls or updated_cls.modified_count == 0:
        raise HTTPException(status_code=400, detail="คอร์สนี้เต็มแล้ว")

    # Sync class status to 'full' safely if it reached capacity
    cls = await Class.get(class_id)
    if cls and cls.bookedSeats >= cls.maxSeats and cls.status != "full":
        cls.status = "full"
        await cls.save()

    # 4. Create booking using correct IDs
    new_booking = Booking(
        classId=payload.classId,
        studentId=current_user.id,
        studentName=current_user.name or current_user.email,
        status="pending",
        slipUrl=None,
    )
    await new_booking.insert()
    return new_booking


@router.put("/bookings/{booking_id}/status", response_model=BookingSchema)
async def update_booking_status(
    booking_id: PydanticObjectId,
    payload: BookingStatusUpdate,
    current_user: User = Depends(get_current_active_user),
):
    booking = await Booking.find_one(Booking.id == booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="ไม่พบรายการจอง")

    old_status = booking.status
    booking.status = payload.status
    booking.updated_date = datetime.now(timezone.utc)
    await booking.save()

    if payload.status == "rejected" and old_status != "rejected":
        cls = await Class.find_one(Class.id == booking.classId)
        if cls and cls.bookedSeats > 0:
            cls.bookedSeats -= 1
            if cls.bookedSeats < cls.maxSeats:
                cls.status = "open"
            await cls.save()

    return booking


@router.put("/bookings/{booking_id}/slip", response_model=BookingSchema)
async def update_booking_slip(
    booking_id: PydanticObjectId,
    payload: BookingSlipUpdate,
    current_user: User = Depends(get_current_active_user),
):
    booking = await Booking.find_one(Booking.id == booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="ไม่พบรายการจอง")

    booking.status = "checking"
    booking.slipUrl = payload.slipUrl
    booking.updated_date = datetime.now(timezone.utc)
    await booking.save()
    return booking


# --- Settings Endpoints ---
@router.get("/settings", response_model=SettingsSchema)
async def get_my_settings(current_user: User = Depends(get_current_active_user)):
    settings_doc = await Settings.find_one(Settings.tutorId == current_user.id)
    if not settings_doc:
        settings_doc = Settings(tutorId=current_user.id)
        await settings_doc.insert()
    return settings_doc


@router.get("/settings/{tutor_id}", response_model=SettingsSchema)
async def get_tutor_settings(tutor_id: PydanticObjectId):
    settings_doc = await Settings.find_one(Settings.tutorId == tutor_id)
    if not settings_doc:
        settings_doc = Settings(tutorId=tutor_id)
    return settings_doc


@router.put("/settings", response_model=SettingsSchema)
async def update_settings(
    payload: SettingsSchema, current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="ไม่มีสิทธิ์ดำเนินการ (เฉพาะอาจารย์ผู้สอน)"
        )

    settings_doc = await Settings.find_one(Settings.tutorId == current_user.id)
    if not settings_doc:
        settings_doc = Settings(tutorId=current_user.id)
        await settings_doc.insert()

    settings_doc.name = payload.name
    settings_doc.bankName = payload.bankName
    settings_doc.accountName = payload.accountName
    settings_doc.accountNumber = payload.accountNumber
    settings_doc.auto_accept_followers = payload.auto_accept_followers
    settings_doc.payment_timeout_minutes = payload.payment_timeout_minutes
    await settings_doc.save()
    return settings_doc


# --- Attendance Endpoints ---
@router.get("/attendance", response_model=List[str])
async def get_attendance(current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        # Students shouldn't see all attendance records, but maybe only their own?
        # For now, restrict to tutor only
        return []

    my_classes = await Class.find(Class.tutorId == current_user.id).to_list()
    my_class_ids = [c.id for c in my_classes]
    records = await Attendance.find(In(Attendance.classId, my_class_ids)).to_list()
    return [str(rec.id) for rec in records]


@router.post("/attendance/toggle")
async def toggle_attendance(
    payload: AttendanceToggleSchema,
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="ไม่มีสิทธิ์ดำเนินการ (เฉพาะอาจารย์ผู้สอน)"
        )

    existing = await Attendance.find_one(
        Attendance.classId == payload.classId,
        Attendance.schIndex == payload.schIndex,
        Attendance.studentId == payload.studentId,
    )
    if existing:
        await existing.delete()
        return {"checked": False}
    else:
        new_att = Attendance(
            classId=payload.classId,
            schIndex=payload.schIndex,
            studentId=payload.studentId,
        )
        await new_att.insert()
        return {"checked": True}
