from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import crud, database
from ..schemas import equipment

router = APIRouter(
    prefix="/api/equipments",
    tags=["equipments"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=equipment.Equipment)
def create_equipment(
    equipment_data: equipment.EquipmentCreate, db: Session = Depends(database.get_db)
):
    try:
        return crud.create_equipment(db=db, equipment=equipment_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[equipment.Equipment])
def read_equipments(
    type: Optional[str] = Query(None, description="장비 타입으로 필터링 (코팅, 노광, 현상)"),
    db: Session = Depends(database.get_db)
):
    equipments = crud.get_equipments(db, type=type)
    return equipments

@router.get("/by-type/{equipment_type}", response_model=List[equipment.Equipment])
def get_equipments_by_type(
    equipment_type: str, 
    db: Session = Depends(database.get_db)
):
    """특정 타입의 장비 목록 조회"""
    equipments = crud.get_equipments(db, type=equipment_type)
    return equipments

@router.get("/{equipment_id:int}", response_model=equipment.Equipment)
def read_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    db_equipment = crud.get_equipment(db, equipment_id=equipment_id)
    if db_equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return db_equipment

@router.put("/{equipment_id:int}", response_model=equipment.Equipment)
def update_equipment(
    equipment_id: int, equipment_data: equipment.EquipmentCreate, db: Session = Depends(database.get_db)
):
    try:
        db_equipment = crud.update_equipment(db, equipment_id=equipment_id, equipment=equipment_data)
        if db_equipment is None:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return db_equipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{equipment_id:int}", response_model=bool)
def delete_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_equipment(db, equipment_id=equipment_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete equipment that is in use")
    return success