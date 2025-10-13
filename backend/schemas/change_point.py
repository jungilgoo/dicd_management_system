from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ChangePointBase(BaseModel):
    product_group_id: int
    process_id: int
    target_id: int
    change_date: datetime
    description: str


class ChangePointCreate(ChangePointBase):
    pass


class ChangePointUpdate(BaseModel):
    product_group_id: Optional[int] = None
    process_id: Optional[int] = None
    target_id: Optional[int] = None
    change_date: Optional[datetime] = None
    description: Optional[str] = None


class ChangePoint(ChangePointBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ChangePointWithDetails(ChangePoint):
    product_group_name: str
    process_name: str
    target_name: str
    
    class Config:
        from_attributes = True