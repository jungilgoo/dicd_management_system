from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AuthorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="작성자 이름")
    process_type: str = Field(..., description="공정 타입 (PHOTO, ETCH)")
    is_active: bool = True


class AuthorCreate(AuthorBase):
    pass


class AuthorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


class Author(AuthorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
