from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

# 공정 생성 요청 스키마
class ProcessCreate(BaseModel):
    product_group_id: int
    name: str
    description: Optional[str] = None

# 공정 응답 스키마
class Process(BaseModel):
    id: int
    product_group_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True