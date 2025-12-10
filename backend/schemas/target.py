from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

# 타겟 생성 요청 스키마
class TargetCreate(BaseModel):
    process_id: int
    name: str
    description: Optional[str] = None
    process_type: str = Field(default='PHOTO', description="공정 타입 (PHOTO, ETCH)")

# 타겟 응답 스키마
class Target(BaseModel):
    id: int
    process_id: int
    name: str
    description: Optional[str] = None
    process_type: str = 'PHOTO'
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True