"""
WBS 3.2.2, 4.2.2 | Role: [Lead Dev / Backend]
Точка входа в приложение. Подключение роутеров и обработка ошибок валидации.
"""
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, health, movie
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
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        error.pop("input", None)  # Удаляем введенные данные из ответа
        # ctx может содержать объект ValueError — он не сериализуется в JSON
        error.pop("ctx", None)
        errors.append(error)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(errors)},
    )


# Подключение роутеров
app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(movie.router, prefix=settings.api_v1_prefix)  # Новый роутер афиши


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"service": "bileton-api", "docs": "/docs"}