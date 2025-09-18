from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

# 제품군 생성 요청 스키마
class ProductGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

# 제품군 응답 스키마
class ProductGroup(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True