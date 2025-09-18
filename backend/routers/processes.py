from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import crud, models, database
from ..schemas import process

router = APIRouter(
    prefix="/api/processes",
    tags=["processes"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=process.Process)
def create_process(
    process_data: process.ProcessCreate, db: Session = Depends(database.get_db)
):
    return crud.create_process(db=db, process=process_data)

@router.get("/", response_model=List[process.Process])
def read_processes(
    product_group_id: int = None, db: Session = Depends(database.get_db)
):
    processes = crud.get_processes(db, product_group_id=product_group_id)
    return processes

@router.get("/{process_id}", response_model=process.Process)
def read_process(process_id: int, db: Session = Depends(database.get_db)):
    db_process = crud.get_process(db, process_id=process_id)
    if db_process is None:
        raise HTTPException(status_code=404, detail="Process not found")
    return db_process

@router.put("/{process_id}", response_model=process.Process)
def update_process(
    process_id: int, process_data: process.ProcessCreate, db: Session = Depends(database.get_db)
):
    db_process = crud.update_process(db, process_id=process_id, process=process_data)
    if db_process is None:
        raise HTTPException(status_code=404, detail="Process not found")
    return db_process

@router.delete("/{process_id}", response_model=bool)
def delete_process(process_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_process(db, process_id=process_id)
    if not success:
        raise HTTPException(status_code=404, detail="Process not found")
    return success