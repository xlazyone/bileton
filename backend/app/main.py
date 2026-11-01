"""
WBS 3.2.2 | Role: [Lead Dev / Backend]
Точка входа в приложение. Обработка ошибок валидации.
"""
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import auth, health
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API сервиса бронирования билетов в кино «БилетON».",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Issue: Защита от утечки введенных данных (паролей) в ответах об ошибках
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = exc.errors()
    for error in errors:
        error.pop("input", None)  # Удаляем введенные данные из ответа
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)

@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"service": "bileton-api", "docs": "/docs"}