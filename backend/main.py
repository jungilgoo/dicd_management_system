import sys
import os

# 프로젝트 루트 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import models, database

# 라우터 임포트
import backend.routers.product_groups as product_groups_router
import backend.routers.processes as processes_router
import backend.routers.targets as targets_router
from backend.routers import measurements
from backend.routers import specs
from backend.routers import statistics
from backend.routers import spc as spc_router
from backend.routers import reports
from backend.routers import equipments as equipments_router
from backend.routers import duplicate_check
from backend.routers import distribution as distribution_router
from backend.routers import report_downloads
from backend.routers import bulk_upload as bulk_upload_router
from backend.routers import pr_thickness as pr_thickness_router
from backend.routers import change_points as change_points_router

# 데이터베이스 테이블 생성 (에러 발생 시 서버는 계속 실행)
try:
    models.Base.metadata.create_all(bind=database.engine)
    print("✅ 데이터베이스 연결 및 테이블 생성 성공")
except Exception as e:
    print(f"⚠️ 데이터베이스 연결 실패: {e}")
    print("📋 서버는 계속 실행되지만 데이터베이스 기능은 제한될 수 있습니다.")

app = FastAPI(
    title="DICD 측정 관리 시스템", 
    description="DICD 측정값을 관리하고 분석하기 위한 API",
    version="0.1.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔽 정적 파일 서빙 설정 (라우터보다 먼저)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# 🔽 API 라우터 등록
print("📋 API 라우터들을 등록합니다...")
app.include_router(product_groups_router.router)
app.include_router(processes_router.router)
app.include_router(targets_router.router)
app.include_router(measurements.router)
app.include_router(specs.router)
app.include_router(statistics.router)
app.include_router(spc_router.router)
app.include_router(reports.router)
app.include_router(equipments_router.router)
app.include_router(duplicate_check.router)
app.include_router(distribution_router.router)
app.include_router(report_downloads.router)
app.include_router(bulk_upload_router.router)
app.include_router(pr_thickness_router.router)
app.include_router(change_points_router.router)
print("✅ 모든 API 라우터 등록 완료")


# 🔽 프론트엔드 서빙 라우터들 (API 라우터들 다음에 등록)

# 루트 경로에 index.html 반환
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# favicon.ico 처리
@app.get("/favicon.ico")
async def serve_favicon():
    from fastapi.responses import Response
    return Response(status_code=204)  # No Content


# 서버 실행
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
