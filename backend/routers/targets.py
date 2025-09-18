from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
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
    process_id: int = None, db: Session = Depends(database.get_db)
):
    targets = crud.get_targets(db, process_id=process_id)
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

@router.delete("/{target_id}", response_model=bool)
def delete_target(target_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_target(db, target_id=target_id)
    if not success:
        raise HTTPException(status_code=404, detail="Target not found")
    return success