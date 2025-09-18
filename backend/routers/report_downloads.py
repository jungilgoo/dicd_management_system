from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os

from ..database import database, models

router = APIRouter(
    prefix="/api/report-downloads",
    tags=["report-downloads"],
    responses={404: {"description": "Not found"}},
)

@router.get("/{report_id}", response_class=FileResponse)
def download_report(
    report_id: int = Path(..., description="보고서 ID"),
    db: Session = Depends(database.get_db)
):
    """
    보고서 파일 다운로드
    """
    # 보고서 정보 조회
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # 파일 경로 확인
    file_path = report.file_path
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # 파일명 생성
    file_name = os.path.basename(file_path)
    
    # 컨텐츠 타입 지정
    media_type = "application/pdf"  # 기본값: PDF
    
    # 파일 확장자에 따라 다른 미디어 타입 적용
    if file_path.lower().endswith('.xlsx'):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif file_path.lower().endswith('.csv'):
        media_type = "text/csv"
    
    # 파일 응답 반환
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type=media_type
    )