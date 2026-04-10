from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ..database import database
from ..services import spc

router = APIRouter(
    prefix="/api/spc",
    tags=["spc"],
    responses={404: {"description": "Not found"}},
)

@router.get("/analyze/{target_id}", response_model=Dict[str, Any])
def analyze_spc_data(
    target_id: int,
    days: Optional[int] = Query(30, description="분석할 기간(일)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    last_n: Optional[int] = Query(None, description="최근 N개 데이터 포인트"),
    db: Session = Depends(database.get_db)
):
    """
    특정 타겟에 대한 SPC 분석 수행
    """
    # last_n 모드일 경우 날짜 필터 건너뜀
    custom_start_date = None
    custom_end_date = None

    if not last_n and start_date and end_date:
        try:
            custom_start_date = datetime.strptime(start_date, "%Y-%m-%d")
            custom_end_date = datetime.strptime(end_date, "%Y-%m-%d")
            custom_end_date = custom_end_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    result = spc.analyze_spc(
        db,
        target_id=target_id,
        days=days,
        start_date=custom_start_date,
        end_date=custom_end_date,
        last_n=last_n
    )
    
    if result["sample_count"] == 0:
        raise HTTPException(status_code=404, detail="No measurement data found for this target in the specified period")
    
    return result

