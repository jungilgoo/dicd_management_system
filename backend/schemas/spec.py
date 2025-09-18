from typing import Optional
from pydantic import BaseModel, validator
from datetime import datetime

class SpecCreate(BaseModel):
    target_id: int
    lsl: float  # 하한 규격 한계
    usl: float  # 상한 규격 한계
    reason: Optional[str] = None  # 변경 사유
    
    @validator('usl')
    def validate_usl_greater_than_lsl(cls, v, values):
        if 'lsl' in values and v <= values['lsl']:
            raise ValueError('USL must be greater than LSL')
        return v

class Spec(BaseModel):
    id: int
    target_id: int
    lsl: float
    usl: float
    is_active: bool
    reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True