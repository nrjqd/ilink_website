from fastapi import HTTPException, status


def api_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": {"code": code, "message": message}})


def unauthorized(message: str = "Unauthorized") -> HTTPException:
    return api_error(status.HTTP_401_UNAUTHORIZED, "AUTH_UNAUTHORIZED", message)
