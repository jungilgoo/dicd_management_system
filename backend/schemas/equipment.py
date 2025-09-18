from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class EquipmentBase(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    is_active: bool = True

class EquipmentCreate(EquipmentBase):
    pass

class Equipment(EquipmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True