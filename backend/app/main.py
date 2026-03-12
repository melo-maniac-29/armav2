from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.app.config import get_settings
from backend.app.api import auth
from backend.app.api import settings as settings_router
from backend.app.api import github as github_router
from backend.app.api import repos as repos_router
from backend.app.api import analysis as analysis_router
from backend.app.api import search as search_router
from backend.app.api import webhooks as webhooks_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="ARMA v3", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(settings_router.router, prefix="/settings", tags=["settings"])
app.include_router(github_router.router, prefix="/github", tags=["github"])
app.include_router(repos_router.router, prefix="/repos", tags=["repos"])
app.include_router(analysis_router.router, prefix="/repos", tags=["analysis"])
app.include_router(search_router.router, prefix="/repos", tags=["search"])
app.include_router(webhooks_router.router, prefix="/webhooks", tags=["webhooks"])


@app.get("/health")
async def health():
    return {"status": "ok"}
