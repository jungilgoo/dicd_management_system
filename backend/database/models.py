from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base

# 제품군 테이블
class ProductGroup(Base):
    __tablename__ = "product_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    processes = relationship("Process", back_populates="product_group", cascade="all, delete-orphan")

# 공정 테이블
class Process(Base):
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    product_group_id = Column(Integer, ForeignKey("product_groups.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    product_group = relationship("ProductGroup", back_populates="processes")
    targets = relationship("Target", back_populates="process", cascade="all, delete-orphan")

# 타겟값 테이블
class Target(Base):
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("processes.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    process = relationship("Process", back_populates="targets")
    specs = relationship("Spec", back_populates="target", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="target", cascade="all, delete-orphan")

# SPEC 테이블
class Spec(Base):
    __tablename__ = "specs"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    lsl = Column(Float, nullable=False)  # 하한 규격 한계
    usl = Column(Float, nullable=False)  # 상한 규격 한계
    is_active = Column(Boolean, default=True)  # 현재 활성화된 SPEC인지 여부
    reason = Column(String(255), nullable=True)  # 변경 사유
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    target = relationship("Target", back_populates="specs")

# Equipment 클래스 (models.py 파일에 있는 기존 코드 확인)
class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # 코팅, 노광, 현상 등
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    coating_measurements = relationship("Measurement", foreign_keys="Measurement.coating_equipment_id", back_populates="coating_equipment")
    exposure_measurements = relationship("Measurement", foreign_keys="Measurement.exposure_equipment_id", back_populates="exposure_equipment")
    development_measurements = relationship("Measurement", foreign_keys="Measurement.development_equipment_id", back_populates="development_equipment")


# Measurement 클래스 수정 부분
class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    
    # 기존 equipment_id를 세 개의 장비 ID로 변경
    # equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)  # 이 줄 제거
    coating_equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)
    exposure_equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)
    development_equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)
    
    device = Column(String(100), nullable=False)
    lot_no = Column(String(100), nullable=False, index=True)
    wafer_no = Column(String(10), nullable=False)
    exposure_time = Column(Integer, nullable=True)
    value_top = Column(Float, nullable=False)
    value_center = Column(Float, nullable=False)
    value_bottom = Column(Float, nullable=False)
    value_left = Column(Float, nullable=False)
    value_right = Column(Float, nullable=False)
    
    # 자동 계산 값
    avg_value = Column(Float, nullable=False)
    min_value = Column(Float, nullable=False)
    max_value = Column(Float, nullable=False)
    range_value = Column(Float, nullable=False)
    std_dev = Column(Float, nullable=False)
    
    author = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정 수정
    target = relationship("Target", back_populates="measurements")
    
    coating_equipment = relationship("Equipment", foreign_keys=[coating_equipment_id], back_populates="coating_measurements")
    exposure_equipment = relationship("Equipment", foreign_keys=[exposure_equipment_id], back_populates="exposure_measurements")
    development_equipment = relationship("Equipment", foreign_keys=[development_equipment_id], back_populates="development_measurements")
    

# SPC 규칙 테이블
class SPCRule(Base):
    __tablename__ = "spc_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    rule_changes = relationship("SPCRuleChange", back_populates="spc_rule", cascade="all, delete-orphan")

# SPC 규칙 변경 이력 테이블
class SPCRuleChange(Base):
    __tablename__ = "spc_rule_changes"

    id = Column(Integer, primary_key=True, index=True)
    spc_rule_id = Column(Integer, ForeignKey("spc_rules.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # 활성화, 비활성화, 수정 등
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    spc_rule = relationship("SPCRule", back_populates="rule_changes")

# 보고서 테이블
class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)  # weekly, monthly
    file_path = Column(String(255), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    report_recipients = relationship("ReportRecipient", back_populates="report", cascade="all, delete-orphan")

# 보고서 수신자 테이블
class ReportRecipient(Base):
    __tablename__ = "report_recipients"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    email = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    report = relationship("Report", back_populates="report_recipients")


# ===== PR Thickness 전용 모델들 =====

# PR Thickness 장비 설정 테이블
class PRThicknessEquipment(Base):
    __tablename__ = "pr_thickness_equipments"

    id = Column(Integer, primary_key=True, index=True)
    equipment_number = Column(Integer, unique=True, nullable=False, index=True)  # 1-10
    name = Column(String(100), nullable=False)  # "장비1", "장비2" 등
    target_thickness = Column(Integer, nullable=False)  # 목표 두께 (Å)
    spec_min = Column(Integer, nullable=False)  # SPEC 최소값 (Å)
    spec_max = Column(Integer, nullable=False)  # SPEC 최대값 (Å)
    wafer_count = Column(Integer, nullable=False, default=1)  # 측정할 웨이퍼 수 (1-10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    measurements = relationship("PRThicknessMeasurement", back_populates="equipment", cascade="all, delete-orphan")


# PR Thickness 측정 데이터 테이블
class PRThicknessMeasurement(Base):
    __tablename__ = "pr_thickness_measurements"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("pr_thickness_equipments.id"), nullable=False)
    target_thickness = Column(Integer, nullable=False)  # 목표 두께 (Å)
    
    # 5개 위치별 측정값 (Å)
    value_top = Column(Integer, nullable=True)
    value_center = Column(Integer, nullable=True)
    value_bottom = Column(Integer, nullable=True)
    value_left = Column(Integer, nullable=True)
    value_right = Column(Integer, nullable=True)
    
    # 자동 계산된 값들
    avg_value = Column(Integer, nullable=True)  # 평균값
    range_value = Column(Integer, nullable=True)  # 범위 (최대값 - 최소값)
    
    author = Column(String(100), nullable=False)  # 작성자
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    equipment = relationship("PRThicknessEquipment", back_populates="measurements")


# 변경점 등록 테이블
class ChangePoint(Base):
    __tablename__ = "change_points"

    id = Column(Integer, primary_key=True, index=True)
    product_group_id = Column(Integer, ForeignKey("product_groups.id"), nullable=False)
    process_id = Column(Integer, ForeignKey("processes.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    change_date = Column(DateTime, nullable=False, index=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    product_group = relationship("ProductGroup")
    process = relationship("Process")
    target = relationship("Target")

