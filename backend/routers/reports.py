from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import os

from ..database import database, models
from ..schemas import report
from ..services import reports

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    responses={404: {"description": "Not found"}},
)

@router.get("/weekly/{target_id}", response_class=StreamingResponse)
def generate_weekly_report(
    target_id: int,
    background_tasks: BackgroundTasks,
    date: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    """
    주간 보고서 생성 및 다운로드
    """
    # 날짜 파싱
    report_date = datetime.now()
    if date:
        try:
            report_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # 타겟 존재 여부 확인
    target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # 보고서 생성
    buffer = reports.generate_weekly_report(db, target_id, report_date)
    
    # 날짜 범위 계산 (월요일~일요일 기준)
    days_since_monday = report_date.weekday()
    start_date = report_date - timedelta(days=days_since_monday, weeks=1)
    end_date = start_date + timedelta(days=6)
    
    # 프로세스 및 제품군 정보 조회
    process = db.query(models.Process).filter(models.Process.id == target.process_id).first()
    product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == process.product_group_id).first()
    
    # 파일 이름 설정
    filename = f"weekly_report_{product_group.name}_{process.name}_{target.name}_{start_date.strftime('%Y%m%d')}.pdf"
    
    # 보고서 정보 저장 (백그라운드 작업)
    def save_report_info():
        # 저장 경로 설정 (실제 환경에 맞게 조정 필요)
        save_dir = os.path.join(os.getcwd(), "reports")
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, filename)
        
        # 파일 저장
        with open(file_path, "wb") as f:
            f.write(buffer.getvalue())
        
        # DB에 보고서 정보 저장
        reports.save_report_to_database(
            db, target_id, "weekly", file_path, start_date, end_date
        )
    
    background_tasks.add_task(save_report_info)
    
    # 스트리밍 응답으로 PDF 반환
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/monthly/{target_id}", response_class=StreamingResponse)
def generate_monthly_report(
    target_id: int,
    background_tasks: BackgroundTasks,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(database.get_db)
):
    """
    월간 보고서 생성 및 다운로드
    """
    # 년월 파싱
    now = datetime.now()
    report_year = year if year else now.year
    report_month = month if month else now.month
    
    try:
        report_date = datetime(report_year, report_month, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year/month")
    
    # 타겟 존재 여부 확인
    target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # 보고서 생성
    buffer = reports.generate_monthly_report(db, target_id, report_date)
    
    # 날짜 범위 계산
    start_date = datetime(report_year, report_month, 1)
    if report_month == 12:
        end_date = datetime(report_year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = datetime(report_year, report_month + 1, 1) - timedelta(days=1)
    
    # 프로세스 및 제품군 정보 조회
    process = db.query(models.Process).filter(models.Process.id == target.process_id).first()
    product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == process.product_group_id).first()
    
    # 파일 이름 설정
    filename = f"monthly_report_{product_group.name}_{process.name}_{target.name}_{report_year}{report_month:02d}.pdf"
    
    # 보고서 정보 저장 (백그라운드 작업)
    def save_report_info():
        # 저장 경로 설정 (실제 환경에 맞게 조정 필요)
        save_dir = os.path.join(os.getcwd(), "reports")
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, filename)
        
        # 파일 저장
        with open(file_path, "wb") as f:
            f.write(buffer.getvalue())
        
        # DB에 보고서 정보 저장
        reports.save_report_to_database(
            db, target_id, "monthly", file_path, start_date, end_date
        )
    
    background_tasks.add_task(save_report_info)
    
    # 스트리밍 응답으로 PDF 반환
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/", response_model=List[report.Report])
def get_reports(
    target_id: Optional[int] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    """
    보고서 목록 조회
    """
    query = db.query(models.Report)
    
    # 필터링
    if target_id:
        # 타겟 ID로 필터링하려면 보고서 제목에서 찾기
        query = query.filter(models.Report.title.like(f"%Target ID: {target_id}%"))
    
    if report_type:
        query = query.filter(models.Report.report_type == report_type)
    
    # 최신 보고서 순으로 정렬
    query = query.order_by(models.Report.created_at.desc())
    
    reports_list = query.all()
    return reports_list

@router.post("/recipients", response_model=report.ReportRecipient)
def add_recipient(
    recipient_data: report.ReportRecipientCreate,
    db: Session = Depends(database.get_db)
):
    """
    보고서 수신자 추가
    """
    # 보고서 존재 여부 확인
    report = db.query(models.Report).filter(models.Report.id == recipient_data.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # 수신자 추가
    recipient = reports.add_report_recipient(db, recipient_data.report_id, recipient_data.email)
    return recipient