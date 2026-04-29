from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SpcMemoBase(BaseModel):
    product_group_id: int
    process_id: int
    target_id: int
    process_type: str = Field(default='PHOTO')
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class SpcMemoCreate(SpcMemoBase):
    pass


class SpcMemoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1)


class SpcMemo(SpcMemoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SpcMemoSummary(BaseModel):
    """카드 헤더 뱃지/알림 바용 요약"""
    count: int = 0
    latest_id: Optional[int] = None
    latest_title: Optional[str] = None
    latest_created_at: Optional[datetime] = None
