from typing import Optional, List, Dict, Any
from pydantic import BaseModel, validator
from datetime import datetime
import statistics

class MeasurementCreate(BaseModel):
    target_id: int
    # equipment_id 대신 세 개의 장비 ID로 변경
    coating_equipment_id: Optional[int] = None
    exposure_equipment_id: Optional[int] = None
    development_equipment_id: Optional[int] = None
    device: str
    lot_no: str
    wafer_no: str
    exposure_time: Optional[int] = None
    value_top: float
    value_center: float
    value_bottom: float
    value_left: float
    value_right: float
    author: str
    
    @validator('wafer_no')
    def validate_wafer_no(cls, v):
        # 숫자 확인 및 범위 검사 (01~50)
        try:
            wafer_no = int(v)
            if wafer_no < 1 or wafer_no > 50:
                raise ValueError('Wafer number must be between 01 and 50')
        except ValueError:
            raise ValueError('Wafer number must be a valid number')
        return v
    
    @validator('value_top', 'value_center', 'value_bottom', 'value_left', 'value_right')
    def validate_values(cls, v):
        # 측정값이 유효한 숫자인지 확인
        if v is None:
            raise ValueError('Measurement value cannot be None')
        return round(float(v), 3)  # 소수점 3자리까지 반올림

class Measurement(BaseModel):
    id: int
    target_id: int
    # equipment_id 대신 세 개의 장비 ID로 변경
    coating_equipment_id: Optional[int] = None
    exposure_equipment_id: Optional[int] = None
    development_equipment_id: Optional[int] = None
    device: str
    lot_no: str
    wafer_no: str
    exposure_time: Optional[int] = None
    value_top: float
    value_center: float
    value_bottom: float
    value_left: float
    value_right: float
    avg_value: float
    min_value: float
    max_value: float
    range_value: float
    std_dev: float
    author: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class MeasurementWithSpec(Measurement):
    spec_status: Dict[str, Any]  # LSL, USL, 상태 등