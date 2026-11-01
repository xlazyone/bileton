from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Проверка работоспособности API")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "bileton-api"}
