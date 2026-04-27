from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from ..database import database
from ..services import distribution

router = APIRouter(
    prefix="/api/distribution",
    tags=["distribution"],
    responses={404: {"description": "Not found"}},
)

# 변경 후
@router.get("/analyze/{target_id}", response_model=Dict[str, Any])
def analyze_distribution(
    target_id: int,
    days: Optional[int] = Query(30, description="분석할 기간(일)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    """
    특정 타겟에 대한 분포 분석 수행
    """
    # 사용자 지정 날짜 처리
    custom_start_date = None
    custom_end_date = None
    
    if start_date and end_date:
        try:
            custom_start_date = datetime.strptime(start_date, "%Y-%m-%d")
            custom_end_date = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일은 해당 일자의 마지막 시간으로 설정
            custom_end_date = custom_end_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    result = distribution.get_distribution_analysis(
        db, 
        target_id=target_id, 
        days=days,
        start_date=custom_start_date,
        end_date=custom_end_date
    )
    
    if result["sample_count"] == 0:
        raise HTTPException(status_code=404, detail="No measurement data found for this target in the specified period")

    return result


def _parse_dates(start_date: Optional[str], end_date: Optional[str]):
    """날짜 문자열을 datetime 객체로 변환"""
    custom_start = custom_end = None
    if start_date and end_date:
        try:
            custom_start = datetime.strptime(start_date, "%Y-%m-%d")
            custom_end   = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    return custom_start, custom_end


@router.get("/site-analysis/{target_id}", response_model=Dict[str, Any])
def get_site_analysis(
    target_id: int,
    days: Optional[int] = Query(30, description="분석 기간(일)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None,
    etch_equipment_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
):
    """위치별 편차 분석 통계 조회 (명세서 3.1)"""
    custom_start, custom_end = _parse_dates(start_date, end_date)
    result = distribution.get_site_analysis(
        db, target_id=target_id, days=days,
        start_date=custom_start, end_date=custom_end,
        coating_equipment_id=coating_equipment_id,
        exposure_equipment_id=exposure_equipment_id,
        development_equipment_id=development_equipment_id,
        etch_equipment_id=etch_equipment_id,
    )
    if result["summary"].get("total_wafers", 0) == 0:
        raise HTTPException(status_code=404, detail="No measurement data found for this target in the specified period")
    return result


@router.get("/site-trend/{target_id}", response_model=Dict[str, Any])
def get_site_trend(
    target_id: int,
    days: Optional[int] = Query(30, description="분석 기간(일)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None,
    etch_equipment_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
):
    """위치별 편차 추이 데이터 조회 (명세서 3.2)"""
    custom_start, custom_end = _parse_dates(start_date, end_date)
    result = distribution.get_site_trend(
        db, target_id=target_id, days=days,
        start_date=custom_start, end_date=custom_end,
        coating_equipment_id=coating_equipment_id,
        exposure_equipment_id=exposure_equipment_id,
        development_equipment_id=development_equipment_id,
        etch_equipment_id=etch_equipment_id,
    )
    if not result["trend_data"]:
        raise HTTPException(status_code=404, detail="No measurement data found for this target in the specified period")
    return result