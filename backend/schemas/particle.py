from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== Particle Equipment 스키마 =====

class ParticleEquipmentBase(BaseModel):
    equipment_number: int = Field(..., ge=1, description="장비 번호")
    name: str = Field(..., min_length=1, max_length=100, description="장비명")
    spec_max: int = Field(..., ge=1, le=99999, description="SPEC 최대값 (개) - 최대 허용 파티클 개수")


class ParticleEquipmentCreate(ParticleEquipmentBase):
    pass


class ParticleEquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    spec_max: Optional[int] = Field(None, ge=1, le=99999)


class ParticleEquipment(ParticleEquipmentBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ===== Particle Measurement 스키마 =====

def _none_if_empty(v):
    if v == '' or v is None:
        return None
    return v


class ParticleMeasurementBase(BaseModel):
    equipment_id: int = Field(..., description="장비 ID")
    before_y: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Yellow (0.3~1.0㎛)")
    before_o: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Orange (1.0~2.5㎛)")
    before_b: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Blue (2.5~5.1㎛)")
    after_y: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Yellow")
    after_o: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Orange")
    after_b: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Blue")
    author: str = Field(..., min_length=1, max_length=100, description="작성자")

    @validator('before_y', 'before_o', 'before_b', 'after_y', 'after_o', 'after_b', pre=True)
    def empty_string_to_none(cls, v):
        return _none_if_empty(v)


class ParticleMeasurementCreate(ParticleMeasurementBase):
    pass


class ParticleMeasurementUpdate(BaseModel):
    before_y: Optional[int] = Field(None, ge=0, le=99999)
    before_o: Optional[int] = Field(None, ge=0, le=99999)
    before_b: Optional[int] = Field(None, ge=0, le=99999)
    after_y: Optional[int] = Field(None, ge=0, le=99999)
    after_o: Optional[int] = Field(None, ge=0, le=99999)
    after_b: Optional[int] = Field(None, ge=0, le=99999)
    author: Optional[str] = Field(None, min_length=1, max_length=100)

    @validator('before_y', 'before_o', 'before_b', 'after_y', 'after_o', 'after_b', pre=True)
    def empty_string_to_none(cls, v):
        return _none_if_empty(v)


class ParticleMeasurement(ParticleMeasurementBase):
    id: int
    final_y: Optional[int] = None
    final_o: Optional[int] = None
    final_b: Optional[int] = None
    value: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime]
    equipment: Optional[ParticleEquipment] = None

    class Config:
        from_attributes = True


# ===== 복합 입력 스키마 =====

class ParticleEquipmentMeasurementData(BaseModel):
    """장비별 측정 데이터"""
    equipment_id: int = Field(..., description="장비 번호 (실제로는 equipment_number)")
    equipment_name: str = Field(..., description="장비명")
    before_y: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Yellow")
    before_o: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Orange")
    before_b: Optional[int] = Field(None, ge=0, le=99999, description="코팅 전 Blue")
    after_y: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Yellow")
    after_o: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Orange")
    after_b: Optional[int] = Field(None, ge=0, le=99999, description="코팅 후 Blue")

    @validator('before_y', 'before_o', 'before_b', 'after_y', 'after_o', 'after_b', pre=True)
    def empty_string_to_none(cls, v):
        return _none_if_empty(v)


class ParticleBulkCreate(BaseModel):
    """일괄 측정 데이터 입력"""
    equipment_data: List[ParticleEquipmentMeasurementData] = Field(..., description="장비별 측정 데이터 목록")
    author: str = Field(..., min_length=1, max_length=100, description="작성자")

    @validator('equipment_data')
    def validate_equipment_data(cls, v):
        if not v:
            raise ValueError('최소 한 개 장비의 측정값을 입력해주세요')
        return v


# ===== 응답 스키마 =====

class ParticleMeasurementWithEquipment(BaseModel):
    """장비 정보를 포함한 측정 데이터"""
    id: int
    equipment_id: int
    equipment_name: str
    before_y: Optional[int] = None
    before_o: Optional[int] = None
    before_b: Optional[int] = None
    after_y: Optional[int] = None
    after_o: Optional[int] = None
    after_b: Optional[int] = None
    final_y: Optional[int] = None
    final_o: Optional[int] = None
    final_b: Optional[int] = None
    value: Optional[int] = None
    author: str
    created_at: datetime

    class Config:
        from_attributes = True


class ParticlePaginatedResponse(BaseModel):
    """페이지네이션된 측정 데이터 응답"""
    data: List[ParticleMeasurementWithEquipment]
    total: int
    page: int
    limit: int
    total_pages: int


# ===== 차트 데이터 스키마 =====

class ParticleChartDataPoint(BaseModel):
    """차트 데이터 포인트"""
    date: str
    value: Optional[int]
    spec_max: int


class ParticleChartData(BaseModel):
    """차트 데이터"""
    labels: List[str]
    data: List[Optional[int]]
    data_y: List[Optional[int]]
    data_o: List[Optional[int]]
    data_b: List[Optional[int]]
    spec_max_line: List[int]
    equipment_name: str


# ===== 통계 데이터 스키마 =====

class ParticleStatistics(BaseModel):
    """Particle 통계 데이터"""
    today_count: int = Field(0, description="오늘 측정 건수")
    week_count: int = Field(0, description="이번 주 측정 건수")
    avg_particle_count: float = Field(0.0, description="평균 파티클 개수")


# ===== 필터 스키마 =====

class ParticleFilter(BaseModel):
    """측정 데이터 필터"""
    equipment_id: Optional[int] = Field(None, description="장비 ID")
    equipment_number: Optional[int] = Field(None, ge=1, description="장비 번호")
    author: Optional[str] = Field(None, description="작성자")
    start_date: Optional[datetime] = Field(None, description="시작일")
    end_date: Optional[datetime] = Field(None, description="종료일")
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(50, ge=1, le=100, description="페이지당 항목 수")


# ===== 장비 설정 관련 스키마 =====

class ParticleEquipmentSettings(BaseModel):
    """전체 장비 설정 (1-10번)"""
    settings: Dict[str, ParticleEquipmentCreate] = Field(..., description="장비별 설정 (키: 장비번호)")

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
