from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class SpcAlarmBase(BaseModel):
    measurement_id: int
    target_id: int
    alarm_type: str
    severity: str
    rule_number: Optional[int] = None
    description: str
    value: float
    cl_snapshot: Optional[float] = None
    ucl_snapshot: Optional[float] = None
    lcl_snapshot: Optional[float] = None
    spec_usl: Optional[float] = None
    spec_lsl: Optional[float] = None
    status: str


class SpcAlarm(SpcAlarmBase):
    id: int
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SpcAlarmListItem(SpcAlarm):
    """알람 목록용 (제품군/공정/타겟명, DEVICE, LOT NO 포함)"""
    product_group_id: Optional[int] = None
    product_group_name: Optional[str] = None
    process_id: Optional[int] = None
    process_name: Optional[str] = None
    target_name: Optional[str] = None
    device: Optional[str] = None
    lot_no: Optional[str] = None


class SpcAlarmAcknowledge(BaseModel):
    acknowledged_by: str


class SpcAlarmResolve(BaseModel):
    resolved_by: str


class SpcAlarmSummary(BaseModel):
    """대시보드용 알람 요약"""
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    total_count: int = 0
