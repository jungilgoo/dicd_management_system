from typing import Optional, List
from pydantic import BaseModel, EmailStr
from datetime import datetime

class ReportBase(BaseModel):
    title: str
    report_type: str  # weekly, monthly

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: int
    file_path: str
    start_date: datetime
    end_date: datetime
    created_at: datetime

    class Config:
        orm_mode = True

class ReportRecipientBase(BaseModel):
    report_id: int
    email: EmailStr

class ReportRecipientCreate(ReportRecipientBase):
    pass

class ReportRecipient(ReportRecipientBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True