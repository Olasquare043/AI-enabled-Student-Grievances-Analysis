from fastapi import APIRouter

from app.api.endpoints import analytics, auth, grievances, health, nlp, operations, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(grievances.router)
api_router.include_router(operations.router)
api_router.include_router(nlp.router)
api_router.include_router(analytics.router)
