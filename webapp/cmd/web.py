import uvicorn
from ..core.config import settings

def main():
    uvicorn.run(
        "webapp.web:create_app",
        host="127.0.0.1",
        port=8000,
        reload=settings.DEBUG,
        factory=True
    )
