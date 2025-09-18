from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import crud, models, database
from ..schemas import product_group

router = APIRouter(
    prefix="/api/product-groups",
    tags=["product-groups"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=product_group.ProductGroup)
def create_product_group(
    product_group: product_group.ProductGroupCreate, db: Session = Depends(database.get_db)
):
    return crud.create_product_group(db=db, product_group=product_group)

@router.get("/", response_model=List[product_group.ProductGroup])
def read_product_groups(db: Session = Depends(database.get_db)):
    product_groups = crud.get_product_groups(db)
    return product_groups

@router.get("/{product_group_id}", response_model=product_group.ProductGroup)
def read_product_group(product_group_id: int, db: Session = Depends(database.get_db)):
    db_product_group = crud.get_product_group(db, product_group_id=product_group_id)
    if db_product_group is None:
        raise HTTPException(status_code=404, detail="Product group not found")
    return db_product_group

@router.put("/{product_group_id}", response_model=product_group.ProductGroup)
def update_product_group(
    product_group_id: int, product_group: product_group.ProductGroupCreate, db: Session = Depends(database.get_db)
):
    db_product_group = crud.update_product_group(db, product_group_id=product_group_id, product_group=product_group)
    if db_product_group is None:
        raise HTTPException(status_code=404, detail="Product group not found")
    return db_product_group

@router.delete("/{product_group_id}", response_model=bool)
def delete_product_group(product_group_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_product_group(db, product_group_id=product_group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product group not found")
    return success