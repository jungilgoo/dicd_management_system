from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import crud, models, database
from ..schemas import spec

router = APIRouter(
    prefix="/api/specs",
    tags=["specs"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=spec.Spec)
def create_spec(
    spec_data: spec.SpecCreate, db: Session = Depends(database.get_db)
):
    return crud.create_spec(db=db, spec_data=spec_data)

@router.get("/", response_model=List[spec.Spec])
def read_specs(
    target_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(database.get_db)
):
    specs = crud.get_specs(db, target_id=target_id, is_active=is_active)
    return specs

@router.get("/{spec_id}", response_model=spec.Spec)
def read_spec(spec_id: int, db: Session = Depends(database.get_db)):
    db_spec = crud.get_spec(db, spec_id=spec_id)
    if db_spec is None:
        raise HTTPException(status_code=404, detail="Spec not found")
    return db_spec

@router.get("/target/{target_id}/active", response_model=spec.Spec)
def read_active_spec(target_id: int, db: Session = Depends(database.get_db)):
    db_spec = crud.get_active_spec(db, target_id=target_id)
    if db_spec is None:
        raise HTTPException(status_code=404, detail="Active spec not found for this target")
    return db_spec

@router.put("/{spec_id}", response_model=spec.Spec)
def update_spec(
    spec_id: int, 
    spec_data: spec.SpecCreate, 
    db: Session = Depends(database.get_db)
):
    db_spec = crud.update_spec(db, spec_id=spec_id, spec_data=spec_data)
    if db_spec is None:
        raise HTTPException(status_code=404, detail="Spec not found")
    return db_spec

@router.put("/{spec_id}/activate", response_model=spec.Spec)
def activate_spec(spec_id: int, db: Session = Depends(database.get_db)):
    db_spec = crud.activate_spec(db, spec_id=spec_id)
    if db_spec is None:
        raise HTTPException(status_code=404, detail="Spec not found")
    return db_spec

@router.delete("/{spec_id}", response_model=bool)
def delete_spec(spec_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_spec(db, spec_id=spec_id)
    if not success:
        raise HTTPException(status_code=404, detail="Spec not found")
    return success