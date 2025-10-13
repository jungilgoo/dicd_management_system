from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import crud, database
from ..schemas import change_point

router = APIRouter(
    prefix="/api/change-points",
    tags=["change-points"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=change_point.ChangePoint)
def create_change_point(
    change_point_data: change_point.ChangePointCreate, 
    db: Session = Depends(database.get_db)
):
    """변경점을 생성합니다."""
    return crud.create_change_point(db=db, change_point_data=change_point_data)


@router.get("/", response_model=List[change_point.ChangePoint])
def read_change_points(
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    db: Session = Depends(database.get_db)
):
    """변경점 목록을 조회합니다."""
    return crud.get_change_points(db, skip=skip, limit=limit)


@router.get("/with-details")
def read_change_points_with_details(
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    db: Session = Depends(database.get_db)
):
    """제품군, 공정, 타겟 정보를 포함한 변경점 목록을 조회합니다."""
    change_points = crud.get_change_points_with_details(db, skip=skip, limit=limit)
    
    result = []
    for cp in change_points:
        result.append({
            "id": cp.id,
            "product_group_id": cp.product_group_id,
            "process_id": cp.process_id,
            "target_id": cp.target_id,
            "change_date": cp.change_date,
            "description": cp.description,
            "created_at": cp.created_at,
            "updated_at": cp.updated_at,
            "product_group_name": cp.product_group.name,
            "process_name": cp.process.name,
            "target_name": cp.target.name
        })
    
    return result


@router.get("/{change_point_id}", response_model=change_point.ChangePoint)
def read_change_point(
    change_point_id: int, 
    db: Session = Depends(database.get_db)
):
    """특정 변경점을 조회합니다."""
    db_change_point = crud.get_change_point(db, change_point_id=change_point_id)
    if db_change_point is None:
        raise HTTPException(status_code=404, detail="Change point not found")
    return db_change_point


@router.get("/by-target/{target_id}", response_model=List[change_point.ChangePoint])
def read_change_points_by_target(
    target_id: int,
    db: Session = Depends(database.get_db)
):
    """특정 타겟의 변경점 목록을 조회합니다."""
    return crud.get_change_points_by_target(db, target_id=target_id)


@router.get("/by-date-range/")
def read_change_points_by_date_range(
    start_date: datetime = Query(..., description="Start date"),
    end_date: datetime = Query(..., description="End date"),
    db: Session = Depends(database.get_db)
):
    """날짜 범위로 변경점을 조회합니다."""
    return crud.get_change_points_by_date_range(db, start_date=start_date, end_date=end_date)


@router.get("/by-target-and-date-range/{target_id}")
def read_change_points_by_target_and_date_range(
    target_id: int,
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    db: Session = Depends(database.get_db)
):
    """특정 타겟의 날짜 범위 내 변경점을 조회합니다."""
    return crud.get_change_points_by_target_and_date_range(
        db, target_id=target_id, start_date=start_date, end_date=end_date
    )


@router.put("/{change_point_id}", response_model=change_point.ChangePoint)
def update_change_point(
    change_point_id: int,
    change_point_data: change_point.ChangePointUpdate,
    db: Session = Depends(database.get_db)
):
    """변경점을 수정합니다."""
    db_change_point = crud.update_change_point(db, change_point_id=change_point_id, change_point_data=change_point_data)
    if db_change_point is None:
        raise HTTPException(status_code=404, detail="Change point not found")
    return db_change_point


@router.delete("/{change_point_id}", response_model=bool)
def delete_change_point(
    change_point_id: int,
    db: Session = Depends(database.get_db)
):
    """변경점을 삭제합니다."""
    success = crud.delete_change_point(db, change_point_id=change_point_id)
    if not success:
        raise HTTPException(status_code=404, detail="Change point not found")
    return success