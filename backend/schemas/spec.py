from typing import Optional
from pydantic import BaseModel, validator
from datetime import datetime

class SpecCreate(BaseModel):
    target_id: int
    lsl: float  # 하한 규격 한계
    usl: float  # 상한 규격 한계
    lcl: float  # 하한 관리 한계
    ucl: float  # 상한 관리 한계
    reason: Optional[str] = None  # 변경 사유

    @validator('usl')
    def validate_usl_greater_than_lsl(cls, v, values):
        if 'lsl' in values and v <= values['lsl']:
            raise ValueError('USL must be greater than LSL')
        return v

    @validator('ucl')
    def validate_ucl_greater_than_lcl(cls, v, values):
        if 'lcl' in values and v <= values['lcl']:
            raise ValueError('UCL must be greater than LCL')
        return v

class Spec(BaseModel):
    id: int
    target_id: int
    lsl: float
    usl: float
    lcl: float
    ucl: float
    is_active: bool
    reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True