from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict
from ..database import crud, database

router = APIRouter(
    prefix="/api/duplicate-check",
    tags=["duplicate-check"],
)

@router.get("/", response_model=Dict[str, bool])
async def check_duplicate_measurement(
    target_id: int = Query(...),
    lot_no: str = Query(...),
    wafer_no: str = Query(...),
    db: Session = Depends(database.get_db)
):
    print(f"Received params: target_id={target_id}, lot_no={lot_no}, wafer_no={wafer_no}")
    existing = crud.check_duplicate_measurement(
        db, target_id=target_id, lot_no=lot_no, wafer_no=wafer_no
    )
    
    return {"isDuplicate": existing}