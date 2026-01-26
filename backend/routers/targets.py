from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import crud, models, database
from ..schemas import target

router = APIRouter(
    prefix="/api/targets",
    tags=["targets"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=target.Target)
def create_target(
    target_data: target.TargetCreate, db: Session = Depends(database.get_db)
):
    return crud.create_target(db=db, target=target_data)

@router.get("/", response_model=List[target.Target])
def read_targets(
    process_id: Optional[int] = None,
    process_type: str = Query('PHOTO', description="공정 타입 (PHOTO, ETCH)"),
    db: Session = Depends(database.get_db)
):
    targets = crud.get_targets(db, process_id=process_id, process_type=process_type)
    return targets

@router.get("/{target_id}", response_model=target.Target)
def read_target(target_id: int, db: Session = Depends(database.get_db)):
    db_target = crud.get_target(db, target_id=target_id)
    if db_target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    return db_target

@router.put("/{target_id}", response_model=target.Target)
def update_target(
    target_id: int, target_data: target.TargetCreate, db: Session = Depends(database.get_db)
):
    db_target = crud.update_target(db, target_id=target_id, target=target_data)
    if db_target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    return db_target

@router.delete("/{target_id}")
def delete_target(target_id: int, db: Session = Depends(database.get_db)):
    result = crud.delete_target(db, target_id=target_id)

    if not result["success"]:
        if result["reason"] == "has_measurements":
            raise HTTPException(
                status_code=400,
                detail=f"측정 데이터가 {result['count']}건 존재하여 삭제할 수 없습니다. 먼저 측정 데이터를 삭제해주세요."
            )
        else:
            raise HTTPException(status_code=404, detail="타겟을 찾을 수 없습니다.")

    return {"success": True}