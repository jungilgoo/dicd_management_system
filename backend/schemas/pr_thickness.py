from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== PR Thickness Equipment 스키마 =====

class PRThicknessEquipmentBase(BaseModel):
    equipment_number: int = Field(..., ge=1, description="장비 번호")
    name: str = Field(..., min_length=1, max_length=100, description="장비명")
    target_thickness: int = Field(..., ge=1, le=99999, description="목표 두께 (Å)")
    spec_min: int = Field(..., ge=1, le=99999, description="SPEC 최소값 (Å)")
    spec_max: int = Field(..., ge=1, le=99999, description="SPEC 최대값 (Å)")
    wafer_count: int = Field(1, ge=1, le=10, description="측정할 웨이퍼 수 (1-10)")

    @validator('spec_max')
    def validate_spec_range(cls, v, values):
        if 'spec_min' in values and v <= values['spec_min']:
            raise ValueError('SPEC 최대값은 최소값보다 커야 합니다')
        return v

    @validator('target_thickness')
    def validate_target_in_spec(cls, v, values):
        if 'spec_min' in values and 'spec_max' in values:
            if not (values['spec_min'] <= v <= values['spec_max']):
                raise ValueError('목표 두께는 SPEC 범위 내에 있어야 합니다')
        return v


class PRThicknessEquipmentCreate(PRThicknessEquipmentBase):
    pass


class PRThicknessEquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_thickness: Optional[int] = Field(None, ge=1, le=99999)
    spec_min: Optional[int] = Field(None, ge=1, le=99999)
    spec_max: Optional[int] = Field(None, ge=1, le=99999)
    wafer_count: Optional[int] = Field(None, ge=1, le=10)


class PRThicknessEquipment(PRThicknessEquipmentBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ===== PR Thickness Measurement 스키마 =====

class MeasurementValues(BaseModel):
    """5개 위치의 측정값"""
    top: Optional[int] = Field(None, ge=1, le=99999, description="상단 측정값 (Å)")
    center: Optional[int] = Field(None, ge=1, le=99999, description="중앙 측정값 (Å)")
    bottom: Optional[int] = Field(None, ge=1, le=99999, description="하단 측정값 (Å)")
    left: Optional[int] = Field(None, ge=1, le=99999, description="좌측 측정값 (Å)")
    right: Optional[int] = Field(None, ge=1, le=99999, description="우측 측정값 (Å)")

    @validator('*', pre=True)
    def empty_string_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class PRThicknessMeasurementBase(BaseModel):
    equipment_id: int = Field(..., description="장비 ID")
    target_thickness: int = Field(..., ge=1, le=99999, description="목표 두께 (Å)")
    value_top: Optional[int] = Field(None, ge=1, le=99999)
    value_center: Optional[int] = Field(None, ge=1, le=99999)
    value_bottom: Optional[int] = Field(None, ge=1, le=99999)
    value_left: Optional[int] = Field(None, ge=1, le=99999)
    value_right: Optional[int] = Field(None, ge=1, le=99999)
    author: str = Field(..., min_length=1, max_length=100, description="작성자")


class PRThicknessMeasurementCreate(PRThicknessMeasurementBase):
    pass


class PRThicknessMeasurementUpdate(BaseModel):
    target_thickness: Optional[int] = Field(None, ge=1, le=99999)
    value_top: Optional[int] = Field(None, ge=1, le=99999)
    value_center: Optional[int] = Field(None, ge=1, le=99999)
    value_bottom: Optional[int] = Field(None, ge=1, le=99999)
    value_left: Optional[int] = Field(None, ge=1, le=99999)
    value_right: Optional[int] = Field(None, ge=1, le=99999)
    author: Optional[str] = Field(None, min_length=1, max_length=100)


class PRThicknessMeasurement(PRThicknessMeasurementBase):
    id: int
    avg_value: Optional[int]
    range_value: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    equipment: Optional[PRThicknessEquipment] = None

    class Config:
        from_attributes = True


# ===== 복합 입력 스키마 =====

class EquipmentMeasurementData(BaseModel):
    """장비별 측정 데이터"""
    equipment_id: int = Field(..., description="장비 번호 (1-10, 실제로는 equipment_number)")
    equipment_name: str = Field(..., description="장비명")
    target_thickness: int = Field(..., ge=1, le=99999, description="목표 두께 (Å)")
    measurements: List[MeasurementValues] = Field(..., description="웨이퍼별 측정값들")


class PRThicknessBulkCreate(BaseModel):
    """일괄 측정 데이터 입력"""
    equipment_data: List[EquipmentMeasurementData] = Field(..., description="장비별 측정 데이터 목록")
    author: str = Field(..., min_length=1, max_length=100, description="작성자")

    @validator('equipment_data')
    def validate_equipment_data(cls, v):
        if not v:
            raise ValueError('최소 한 개 장비의 측정값을 입력해주세요')
        return v


# ===== 응답 스키마 =====

class PRThicknessMeasurementWithEquipment(BaseModel):
    """장비 정보를 포함한 측정 데이터"""
    id: int
    equipment_id: int
    equipment_name: str
    target_thickness: int
    top: Optional[int] = None
    center: Optional[int] = None
    bottom: Optional[int] = None
    left: Optional[int] = None
    right: Optional[int] = None
    avg_value: Optional[int]
    range_value: Optional[int]
    author: str
    created_at: datetime

    class Config:
        from_attributes = True


class PRThicknessPaginatedResponse(BaseModel):
    """페이지네이션된 측정 데이터 응답"""
    data: List[PRThicknessMeasurementWithEquipment]
    total: int
    page: int
    limit: int
    total_pages: int


# ===== 차트 데이터 스키마 =====

class ChartDataPoint(BaseModel):
    """차트 데이터 포인트"""
    date: str
    value: Optional[int]
    target: int
    spec_min: int
    spec_max: int


class PRThicknessChartData(BaseModel):
    """차트 데이터"""
    labels: List[str]
    data: List[Optional[int]]
    target_line: List[int]
    spec_min_line: List[int]
    spec_max_line: List[int]
    equipment_name: str


# ===== 통계 데이터 스키마 =====

class PRThicknessStatistics(BaseModel):
    """PR Thickness 통계 데이터"""
    today_count: int = Field(0, description="오늘 측정 건수")
    week_count: int = Field(0, description="이번 주 측정 건수")
    avg_thickness: float = Field(0.0, description="평균 두께")
    avg_uniformity: float = Field(0.0, description="평균 균일도")


# ===== 필터 스키마 =====

class PRThicknessFilter(BaseModel):
    """측정 데이터 필터"""
    equipment_id: Optional[int] = Field(None, description="장비 ID")
    equipment_number: Optional[int] = Field(None, ge=1, description="장비 번호")
    author: Optional[str] = Field(None, description="작성자")
    start_date: Optional[datetime] = Field(None, description="시작일")
    end_date: Optional[datetime] = Field(None, description="종료일")
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(50, ge=1, le=100, description="페이지당 항목 수")


# ===== 장비 설정 관련 스키마 =====

class PRThicknessEquipmentSettings(BaseModel):
    """전체 장비 설정 (1-10번)"""
    settings: Dict[str, PRThicknessEquipmentCreate] = Field(..., description="장비별 설정 (키: 장비번호)")

    @validator('settings')
    def validate_equipment_numbers(cls, v):
        for equipment_num_str, setting in v.items():
            try:
                equipment_num = int(equipment_num_str)
                if equipment_num < 1:
                    raise ValueError(f'장비 번호는 1 이상이어야 합니다: {equipment_num}')
                if setting.equipment_number != equipment_num:
                    raise ValueError(f'키와 장비 번호가 일치하지 않습니다: {equipment_num_str} != {setting.equipment_number}')
            except ValueError as e:
                if 'invalid literal' in str(e):
                    raise ValueError(f'잘못된 장비 번호 형식: {equipment_num_str}')
                raise
        return v