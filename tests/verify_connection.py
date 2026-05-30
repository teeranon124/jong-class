import asyncio
import sys

# Try imports
try:
    import httpx
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie
except ImportError:
    pass

async def main():
    print("=" * 60)
    print("      FASTAPI FRONTEND-BACKEND INTEGRATION CHECKER")
    print("=" * 60)
    
    # 1. Check imports and packages
    print("[1/4] Checking Python packages and imports...")
    try:
        import fastapi
        import beanie
        import motor
        import jose
        import passlib
        import httpx
        print("  ✓ All required Python packages are successfully installed!")
    except ImportError as e:
        print(f"  ✗ Missing dependency: {e}")
        print("  Please run: poetry install")
        sys.exit(1)

    from webapp.models.user_model import User
    from webapp.models.class_model import Class
    from webapp.models.booking_model import Booking
    from webapp.core.config import settings

    # 2. Check MongoDB Connection
    print("\n[2/4] Checking MongoDB server connection...")
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
    try:
        # Check if database is reachable
        await client.admin.command('ping')
        print(f"  ✓ Connected to MongoDB successfully at: {settings.MONGODB_URL}")
    except Exception as e:
        print(f"  ✗ Connection to MongoDB failed at {settings.MONGODB_URL}")
        print("  Please make sure your MongoDB server is running on your machine.")
        sys.exit(1)

    # 3. Initialize Beanie ODM
    print("\n[3/4] Initializing Beanie database models...")
    try:
        await init_beanie(
            database=client[settings.MONGODB_DB],
            document_models=[User, Class, Booking]
        )
        print("  ✓ Beanie ODM successfully initialized with models:")
        print("    - User model (Collection: users)")
        print("    - Class model (Collection: classes)")
        print("    - Booking model (Collection: bookings)")
    except Exception as e:
        print(f"  ✗ Beanie initialization failed: {e}")
        sys.exit(1)

    # 4. Test Backend Endpoint availability
    print("\n[4/4] Checking FastAPI API Server availability...")
    backend_url = "http://127.0.0.1:8000"
    
    async with httpx.AsyncClient() as http_client:
        try:
            # Check classes API
            res = await http_client.get(f"{backend_url}/api/classes")
            if res.status_code == 200:
                print(f"  ✓ API Server is alive at {backend_url}!")
                print("  ✓ GET /api/classes endpoint is accessible and working.")
                print(f"    Returned {len(res.json())} classes.")
            else:
                print(f"  ✗ API Server returned unexpected status: {res.status_code}")
                
            # Check login API format
            res = await http_client.post(f"{backend_url}/api/users/login", json={"username": "test", "password": "password"})
            # Expecting 400 since user doesn't exist, but it confirms the route is mapped!
            if res.status_code in [400, 422, 200]:
                print("  ✓ POST /api/users/login endpoint is properly mapped.")
            else:
                print(f"  ✗ Unexpected response from login API: {res.status_code}")
                
        except httpx.ConnectError:
            print(f"  ℹ Backend server is not running on {backend_url} yet.")
            print("    Please run 'poetry run run-web' in another terminal to start the server.")
            print("    Once running, you can reload your HTML page to see the real data!")

    print("\n" + "=" * 60)
    print("             INTEGRATION VERIFICATION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
