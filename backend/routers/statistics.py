from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from ..database import database
from ..services import statistics

router = APIRouter(
    prefix="/api/statistics",
    tags=["statistics"],
    responses={404: {"description": "Not found"}},
)

@router.get("/target/{target_id}", response_model=Dict[str, Any])
def get_target_statistics(
    target_id: int,
    days: Optional[int] = Query(14, description="최근 일수 (기본 2주)"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    # 시작 날짜와 종료 날짜 설정
    start_datetime = None
    end_datetime = None

    # 사용자 지정 날짜 처리
    if start_date and end_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일은 해당 일자의 마지막 시간으로 설정
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    elif days:
        # 일수 기준으로 시작 날짜 계산
        start_datetime = datetime.now() - timedelta(days=days)

    # 통계 계산
    result = statistics.get_process_statistics(
        db,
        target_id=target_id,
        start_date=start_datetime,
        end_date=end_datetime
    )

    # 결과가 비어있는 경우
    if result["sample_count"] == 0:
        raise HTTPException(status_code=404, detail="No measurement data found for this target")

    return result

class BulkStatisticsRequest(BaseModel):
    target_ids: List[int]
    days: Optional[int] = 14


@router.post("/targets/bulk", response_model=Dict[str, Any])
def get_bulk_target_statistics(
    request: BulkStatisticsRequest,
    db: Session = Depends(database.get_db)
):
    """
    여러 타겟의 통계를 한 번에 계산.
    데이터 없는 타겟은 결과에서 제외(404 발생 안 함).
    응답: { "results": { target_id: {cpk, sample_count, ...}, ... } }
    """
    start_datetime = datetime.now() - timedelta(days=request.days) if request.days else None

    results = {}
    for target_id in request.target_ids:
        try:
            stats = statistics.get_process_statistics(
                db, target_id=target_id, start_date=start_datetime, end_date=None
            )
            if stats and stats.get("sample_count", 0) > 0:
                results[str(target_id)] = stats
        except Exception:
            continue

    return {"results": results}


@router.get("/boxplot/{target_id}", response_model=Dict[str, Any])
def get_boxplot_statistics(
    target_id: int,
    group_by: str = Query(..., description="그룹화 기준 (equipment, device)"),
    days: Optional[int] = Query(30, description="최근 일수"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    # 시작 날짜와 종료 날짜 설정
    start_datetime = None
    end_datetime = None
    
    # 사용자 지정 날짜 처리
    if start_date and end_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일은 해당 일자의 마지막 시간으로 설정
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    elif days:
        # 일수 기준으로 시작 날짜 계산
        start_datetime = datetime.now() - timedelta(days=days)
    
    # 통계 계산
    result = statistics.get_boxplot_data(
        db, 
        target_id=target_id, 
        group_by=group_by,
        start_date=start_datetime,
        end_date=end_datetime
    )
    
    # 결과가 비어있는 경우
    if not result or len(result["groups"]) == 0:
        raise HTTPException(status_code=404, detail="No measurement data found for boxplot analysis")
    
    return result