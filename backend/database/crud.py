from sqlalchemy.orm import Session
from . import models
from ..schemas import product_group, process, target, measurement, spec, equipment, pr_thickness, change_point
import statistics
from datetime import datetime, timedelta

# 제품군 CRUD 함수
def create_product_group(db: Session, product_group: product_group.ProductGroupCreate):
    db_product_group = models.ProductGroup(
        name=product_group.name,
        description=product_group.description
    )
    db.add(db_product_group)
    db.commit()
    db.refresh(db_product_group)
    return db_product_group

def get_product_groups(db: Session):
    return db.query(models.ProductGroup).all()

def get_product_group(db: Session, product_group_id: int):
    return db.query(models.ProductGroup).filter(models.ProductGroup.id == product_group_id).first()

def update_product_group(db: Session, product_group_id: int, product_group: product_group.ProductGroupCreate):
    db_product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == product_group_id).first()
    if db_product_group:
        db_product_group.name = product_group.name
        db_product_group.description = product_group.description
        db.commit()
        db.refresh(db_product_group)
    return db_product_group

def delete_product_group(db: Session, product_group_id: int):
    db_product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == product_group_id).first()
    if db_product_group:
        db.delete(db_product_group)
        db.commit()
        return True
    return False

# 공정 CRUD 함수
def create_process(db: Session, process: process.ProcessCreate):
    db_process = models.Process(
        product_group_id=process.product_group_id,
        name=process.name,
        description=process.description
    )
    db.add(db_process)
    db.commit()
    db.refresh(db_process)
    return db_process

def get_processes(db: Session, product_group_id: int = None):
    query = db.query(models.Process)
    if product_group_id:
        query = query.filter(models.Process.product_group_id == product_group_id)
    return query.all()

def get_process(db: Session, process_id: int):
    return db.query(models.Process).filter(models.Process.id == process_id).first()

def update_process(db: Session, process_id: int, process: process.ProcessCreate):
    db_process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if db_process:
        db_process.product_group_id = process.product_group_id
        db_process.name = process.name
        db_process.description = process.description
        db.commit()
        db.refresh(db_process)
    return db_process

def delete_process(db: Session, process_id: int):
    db_process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if db_process:
        db.delete(db_process)
        db.commit()
        return True
    return False

# 타겟 CRUD 함수
def create_target(db: Session, target: target.TargetCreate):
    db_target = models.Target(
        process_id=target.process_id,
        name=target.name,
        description=target.description
    )
    db.add(db_target)
    db.commit()
    db.refresh(db_target)
    return db_target

def get_targets(db: Session, process_id: int = None):
    query = db.query(models.Target)
    if process_id:
        query = query.filter(models.Target.process_id == process_id)
    return query.all()

def get_target(db: Session, target_id: int):
    return db.query(models.Target).filter(models.Target.id == target_id).first()

def update_target(db: Session, target_id: int, target: target.TargetCreate):
    db_target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if db_target:
        db_target.process_id = target.process_id
        db_target.name = target.name
        db_target.description = target.description
        db.commit()
        db.refresh(db_target)
    return db_target

def delete_target(db: Session, target_id: int):
    db_target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if db_target:
        db.delete(db_target)
        db.commit()
        return True
    return False

# 측정 데이터 생성 함수 수정
def create_measurement(db: Session, measurement_data: measurement.MeasurementCreate):
    # 측정값의 통계치 계산
    values = [
        measurement_data.value_top,
        measurement_data.value_center,
        measurement_data.value_bottom,
        measurement_data.value_left,
        measurement_data.value_right
    ]
    
    avg_value = statistics.mean(values)
    min_value = min(values)
    max_value = max(values)
    range_value = max_value - min_value
    std_dev = statistics.stdev(values) if len(values) > 1 else 0
    
    # 데이터베이스 객체 생성
    db_measurement = models.Measurement(
        target_id=measurement_data.target_id,
        # equipment_id 대신 세 개의 장비 ID로 변경
        coating_equipment_id=measurement_data.coating_equipment_id,
        exposure_equipment_id=measurement_data.exposure_equipment_id,
        development_equipment_id=measurement_data.development_equipment_id,
        device=measurement_data.device,
        lot_no=measurement_data.lot_no,
        wafer_no=measurement_data.wafer_no,
        exposure_time=measurement_data.exposure_time,
        value_top=measurement_data.value_top,
        value_center=measurement_data.value_center,
        value_bottom=measurement_data.value_bottom,
        value_left=measurement_data.value_left,
        value_right=measurement_data.value_right,
        avg_value=round(avg_value, 3),
        min_value=round(min_value, 3),
        max_value=round(max_value, 3),
        range_value=round(range_value, 3),
        std_dev=round(std_dev, 3),
        author=measurement_data.author
    )
    
    db.add(db_measurement)
    db.commit()
    db.refresh(db_measurement)

    # SPEC 체크 및 알림 생성
    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == db_measurement.target_id,
        models.Spec.is_active == True
    ).first()

    if active_spec:
        # SPEC 범위를 벗어난 값이 있는지 확인
        values = [
            db_measurement.value_top,
            db_measurement.value_center,
            db_measurement.value_bottom,
            db_measurement.value_left,
            db_measurement.value_right
        ]
        
        # SPEC 범위를 벗어난 값이 있는 경우 알림 생성
        if any(v < active_spec.lsl or v > active_spec.usl for v in values):
            from ..services import notification_service
            notification_service.create_spec_violation_notification(
                db=db,
                measurement=db_measurement,
                spec=active_spec
            )
    return db_measurement

# backend/database/crud.py 파일의 get_measurements 함수 업데이트

def get_measurements(db: Session, target_id: int = None, process_id: int = None,
                     product_group_id: int = None, device: str = None, 
                     lot_no: str = None, start_date: datetime = None, 
                     end_date: datetime = None, equipment_id: int = None,
                     keyword: str = None):
    
    # 조인 쿼리를 위한 설정
    query = db.query(models.Measurement)
    
    # 제품군 또는 공정으로 필터링이 필요한 경우 조인 수행
    if product_group_id or process_id:
        query = query.join(models.Target, models.Measurement.target_id == models.Target.id)
        query = query.join(models.Process, models.Target.process_id == models.Process.id)
        
        if product_group_id:
            query = query.filter(models.Process.product_group_id == product_group_id)
        
        if process_id:
            query = query.filter(models.Target.process_id == process_id)
    
    # 기존 필터 적용
    if target_id:
        query = query.filter(models.Measurement.target_id == target_id)
    if device:
        query = query.filter(models.Measurement.device.like(f"%{device}%"))
    if lot_no:
        query = query.filter(models.Measurement.lot_no.like(f"%{lot_no}%"))
    if start_date:
        query = query.filter(models.Measurement.created_at >= start_date)
    if end_date:
        query = query.filter(models.Measurement.created_at <= end_date)
    # equipment_id 필터 - 세 장비 중 하나라도 일치하는 경우 필터링
    if equipment_id:
        query = query.filter(
            (models.Measurement.coating_equipment_id == equipment_id) |
            (models.Measurement.exposure_equipment_id == equipment_id) |
            (models.Measurement.development_equipment_id == equipment_id)
        )
    
    # 키워드 검색 처리
    if keyword:
        query = query.filter(
            (models.Measurement.device.like(f"%{keyword}%")) |
            (models.Measurement.lot_no.like(f"%{keyword}%")) |
            (models.Measurement.wafer_no.like(f"%{keyword}%"))
        )
    
    # 최신 데이터 순으로 정렬
    query = query.order_by(models.Measurement.created_at.desc())
    
    return query.all()

# 측정 데이터 업데이트 함수 수정
def update_measurement(db: Session, measurement_id: int, measurement_data: measurement.MeasurementCreate):
    db_measurement = db.query(models.Measurement).filter(models.Measurement.id == measurement_id).first()
    
    if db_measurement:
        # 업데이트할 필드 설정
        for key, value in measurement_data.dict(exclude_unset=True).items():
            setattr(db_measurement, key, value)
        
        # 통계치 재계산
        values = [
            db_measurement.value_top,
            db_measurement.value_center,
            db_measurement.value_bottom,
            db_measurement.value_left,
            db_measurement.value_right
        ]
        
        db_measurement.avg_value = round(statistics.mean(values), 3)
        db_measurement.min_value = round(min(values), 3)
        db_measurement.max_value = round(max(values), 3)
        db_measurement.range_value = round(db_measurement.max_value - db_measurement.min_value, 3)
        db_measurement.std_dev = round(statistics.stdev(values), 3) if len(values) > 1 else 0
        
        db.commit()
        db.refresh(db_measurement)

        # SPEC 체크 및 알림 생성
        active_spec = db.query(models.Spec).filter(
            models.Spec.target_id == db_measurement.target_id,
            models.Spec.is_active == True
        ).first()

        if active_spec:
            # SPEC 범위를 벗어난 값이 있는지 확인
            values = [
                db_measurement.value_top,
                db_measurement.value_center,
                db_measurement.value_bottom,
                db_measurement.value_left,
                db_measurement.value_right
            ]
            
            # SPEC 범위를 벗어난 값이 있는 경우 알림 생성
            if any(v < active_spec.lsl or v > active_spec.usl for v in values):
                from ..services import notification_service
                notification_service.create_spec_violation_notification(
                    db=db,
                    measurement=db_measurement,
                    spec=active_spec
                )
    
    return db_measurement

def delete_measurement(db: Session, measurement_id: int):
    db_measurement = db.query(models.Measurement).filter(models.Measurement.id == measurement_id).first()
    if db_measurement:
        db.delete(db_measurement)
        db.commit()
        return True
    return False

def check_spec_status(db: Session, measurement_id: int):
    """
    측정값이 SPEC 내에 있는지 확인하고 상태 반환
    """
    db_measurement = db.query(models.Measurement).filter(models.Measurement.id == measurement_id).first()
    if not db_measurement:
        return None
    
    # 현재 활성화된 SPEC 찾기
    db_spec = db.query(models.Spec).filter(
        models.Spec.target_id == db_measurement.target_id,
        models.Spec.is_active == True
    ).first()
    
    if not db_spec:
        return {"spec_found": False}
    
    # 측정값과 SPEC 비교
    values = [
        db_measurement.value_top,
        db_measurement.value_center,
        db_measurement.value_bottom,
        db_measurement.value_left,
        db_measurement.value_right
    ]
    
    result = {
        "spec_found": True,
        "lsl": db_spec.lsl,
        "usl": db_spec.usl,
        "values": {
            "top": {"value": db_measurement.value_top, "in_spec": db_spec.lsl <= db_measurement.value_top <= db_spec.usl},
            "center": {"value": db_measurement.value_center, "in_spec": db_spec.lsl <= db_measurement.value_center <= db_spec.usl},
            "bottom": {"value": db_measurement.value_bottom, "in_spec": db_spec.lsl <= db_measurement.value_bottom <= db_spec.usl},
            "left": {"value": db_measurement.value_left, "in_spec": db_spec.lsl <= db_measurement.value_left <= db_spec.usl},
            "right": {"value": db_measurement.value_right, "in_spec": db_spec.lsl <= db_measurement.value_right <= db_spec.usl}
        },
        "avg": {"value": db_measurement.avg_value, "in_spec": db_spec.lsl <= db_measurement.avg_value <= db_spec.usl},
        "all_in_spec": all(db_spec.lsl <= value <= db_spec.usl for value in values)
    }
    
    return result

# SPEC CRUD 함수
def create_spec(db: Session, spec_data: spec.SpecCreate):
    # 기존 활성 SPEC 비활성화
    db.query(models.Spec).filter(
        models.Spec.target_id == spec_data.target_id,
        models.Spec.is_active == True
    ).update({"is_active": False})
    
    # 새 SPEC 생성
    db_spec = models.Spec(
        target_id=spec_data.target_id,
        lsl=spec_data.lsl,
        usl=spec_data.usl,
        reason=spec_data.reason,
        is_active=True
    )
    
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)
    return db_spec

def get_specs(db: Session, target_id: int = None, is_active: bool = None):
    query = db.query(models.Spec)
    
    if target_id:
        query = query.filter(models.Spec.target_id == target_id)
    if is_active is not None:
        query = query.filter(models.Spec.is_active == is_active)
    
    # 최신 SPEC 순으로 정렬
    query = query.order_by(models.Spec.created_at.desc())
    
    return query.all()

def get_spec(db: Session, spec_id: int):
    return db.query(models.Spec).filter(models.Spec.id == spec_id).first()

def get_active_spec(db: Session, target_id: int):
    return db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()

def update_spec(db: Session, spec_id: int, spec_data: spec.SpecCreate):
    db_spec = db.query(models.Spec).filter(models.Spec.id == spec_id).first()
    
    if db_spec:
        # 업데이트할 필드 설정
        db_spec.target_id = spec_data.target_id
        db_spec.lsl = spec_data.lsl
        db_spec.usl = spec_data.usl
        db_spec.reason = spec_data.reason
        
        db.commit()
        db.refresh(db_spec)
    
    return db_spec

def activate_spec(db: Session, spec_id: int):
    # 같은 타겟의 다른 모든 SPEC 비활성화
    db_spec = db.query(models.Spec).filter(models.Spec.id == spec_id).first()
    if db_spec:
        target_id = db_spec.target_id
        db.query(models.Spec).filter(
            models.Spec.target_id == target_id,
            models.Spec.id != spec_id
        ).update({"is_active": False})
        
        # 현재 SPEC 활성화
        db_spec.is_active = True
        db.commit()
        db.refresh(db_spec)
    
    return db_spec

def delete_spec(db: Session, spec_id: int):
    db_spec = db.query(models.Spec).filter(models.Spec.id == spec_id).first()
    if db_spec:
        db.delete(db_spec)
        db.commit()
        return True
    return False

# 장비 타입 정규화 유틸리티
def _normalize_equipment_type(raw_type: str) -> str:
    """들어오는 장비 타입 문자열을 표준값으로 정규화한다.
    - PR Thickness 계열은 공백/대소문자/언더스코어 차이를 모두 허용
    - 한글 타입은 그대로 사용
    """
    if not isinstance(raw_type, str):
        return raw_type

    normalized = raw_type.strip()

    # 영문 계열은 소문자로 통일해 비교
    lowered = (
        normalized.lower()
        .replace("_", " ")
        .replace("-", " ")
    )
    if lowered == "pr thickness":
        return "PR_Thickness"

    # 한글 타입은 그대로 유지
    if normalized in ["코팅", "노광", "현상"]:
        return normalized

    return normalized

# 장비 CRUD 함수 (crud.py 파일에 추가)
def get_equipments(db: Session, type: str = None):
    """장비 목록 조회 (타입별 필터링 가능)"""
    query = db.query(models.Equipment)
    if type:
        query = query.filter(models.Equipment.type == _normalize_equipment_type(type))
    return query.all()

def get_equipment(db: Session, equipment_id: int):
    """ID로 장비 조회"""
    return db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()

def create_equipment(db: Session, equipment: equipment.EquipmentCreate):
    """장비 생성"""
    # 타입 유효성 검사
    valid_types = ['코팅', '노광', '현상', 'PR_Thickness']
    normalized_type = _normalize_equipment_type(equipment.type)
    if normalized_type not in valid_types:
        raise ValueError(f"Invalid equipment type. Must be one of: {', '.join(valid_types)}")
    
    db_equipment = models.Equipment(
        name=equipment.name,
        type=normalized_type,
        description=equipment.description,
        is_active=equipment.is_active
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

def update_equipment(db: Session, equipment_id: int, equipment: equipment.EquipmentCreate):
    """장비 수정"""
    db_equipment = get_equipment(db, equipment_id=equipment_id)
    
    if db_equipment:
        # 타입 유효성 검사
        valid_types = ['코팅', '노광', '현상', 'PR_Thickness']
        normalized_type = _normalize_equipment_type(equipment.type)
        if normalized_type not in valid_types:
            raise ValueError(f"Invalid equipment type. Must be one of: {', '.join(valid_types)}")
        
        db_equipment.name = equipment.name
        db_equipment.type = normalized_type
        db_equipment.description = equipment.description
        db_equipment.is_active = equipment.is_active
        
        db.commit()
        db.refresh(db_equipment)
    return db_equipment

def delete_equipment(db: Session, equipment_id: int):
    """장비 삭제"""
    db_equipment = get_equipment(db, equipment_id=equipment_id)
    if db_equipment:
        # 측정 데이터에서 참조 중인지 확인
        measurements_count = db.query(models.Measurement).filter(
            (models.Measurement.coating_equipment_id == equipment_id) |
            (models.Measurement.exposure_equipment_id == equipment_id) |
            (models.Measurement.development_equipment_id == equipment_id)
        ).count()
        
        if measurements_count > 0:
            return False  # 측정 데이터가 참조 중이면 삭제 불가
        
        db.delete(db_equipment)
        db.commit()
        return True
    return False

def check_duplicate_measurement(db: Session, target_id: int, lot_no: str, wafer_no: str) -> bool:
    """
    동일한 타겟, LOT NO, WAFER NO 조합의 측정 데이터가 이미 존재하는지 확인
    """
    existing = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.lot_no == lot_no,
        models.Measurement.wafer_no == wafer_no
    ).first()
    
    return existing is not None


# ===== PR Thickness CRUD 함수들 =====

# PR Thickness Equipment CRUD
def create_pr_thickness_equipment(db: Session, equipment: pr_thickness.PRThicknessEquipmentCreate):
    """PR Thickness 장비 생성"""
    db_equipment = models.PRThicknessEquipment(
        equipment_number=equipment.equipment_number,
        name=equipment.name,
        target_thickness=equipment.target_thickness,
        spec_min=equipment.spec_min,
        spec_max=equipment.spec_max,
        wafer_count=equipment.wafer_count
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


def get_pr_thickness_equipments(db: Session):
    """모든 PR Thickness 장비 조회"""
    return db.query(models.PRThicknessEquipment).filter(
        models.PRThicknessEquipment.is_active == True
    ).order_by(models.PRThicknessEquipment.equipment_number).all()


def get_pr_thickness_equipment(db: Session, equipment_id: int):
    """특정 PR Thickness 장비 조회"""
    return db.query(models.PRThicknessEquipment).filter(
        models.PRThicknessEquipment.id == equipment_id,
        models.PRThicknessEquipment.is_active == True
    ).first()


def get_pr_thickness_equipment_by_number(db: Session, equipment_number: int):
    """장비 번호로 PR Thickness 장비 조회"""
    return db.query(models.PRThicknessEquipment).filter(
        models.PRThicknessEquipment.equipment_number == equipment_number,
        models.PRThicknessEquipment.is_active == True
    ).first()


def update_pr_thickness_equipment(db: Session, equipment_id: int, equipment: pr_thickness.PRThicknessEquipmentUpdate):
    """PR Thickness 장비 업데이트"""
    db_equipment = get_pr_thickness_equipment(db, equipment_id)
    if db_equipment:
        for field, value in equipment.dict(exclude_unset=True).items():
            setattr(db_equipment, field, value)
        db.commit()
        db.refresh(db_equipment)
    return db_equipment


def delete_pr_thickness_equipment(db: Session, equipment_id: int):
    """PR Thickness 장비 삭제 (소프트 삭제)"""
    db_equipment = get_pr_thickness_equipment(db, equipment_id)
    if db_equipment:
        db_equipment.is_active = False
        db.commit()
        return True
    return False


def upsert_pr_thickness_equipment(db: Session, equipment: pr_thickness.PRThicknessEquipmentCreate):
    """PR Thickness 장비 생성 또는 업데이트"""
    existing = get_pr_thickness_equipment_by_number(db, equipment.equipment_number)
    if existing:
        # 업데이트
        for field, value in equipment.dict().items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 새로 생성
        return create_pr_thickness_equipment(db, equipment)


# PR Thickness Measurement CRUD
def create_pr_thickness_measurement(db: Session, measurement: pr_thickness.PRThicknessMeasurementCreate):
    """PR Thickness 측정 데이터 생성"""
    # 측정값들을 리스트로 수집하여 평균 및 범위 계산
    values = []
    for value in [measurement.value_top, measurement.value_center, measurement.value_bottom, 
                  measurement.value_left, measurement.value_right]:
        if value is not None:
            values.append(value)
    
    # 평균값 및 범위 계산 (최소 1개 값이 있어야 함)
    avg_value = None
    range_value = None
    if values:
        avg_value = int(sum(values) / len(values))
        if len(values) > 1:
            range_value = max(values) - min(values)
        else:
            range_value = 0
    
    db_measurement = models.PRThicknessMeasurement(
        equipment_id=measurement.equipment_id,
        target_thickness=measurement.target_thickness,
        value_top=measurement.value_top,
        value_center=measurement.value_center,
        value_bottom=measurement.value_bottom,
        value_left=measurement.value_left,
        value_right=measurement.value_right,
        avg_value=avg_value,
        range_value=range_value,
        author=measurement.author
    )
    db.add(db_measurement)
    db.commit()
    db.refresh(db_measurement)
    return db_measurement


def get_pr_thickness_measurements(
    db: Session, 
    equipment_id: int = None, 
    equipment_number: int = None,
    author: str = None,
    start_date: datetime = None, 
    end_date: datetime = None,
    page: int = 1, 
    limit: int = 50
):
    """PR Thickness 측정 데이터 조회 (필터링 및 페이지네이션)"""
    query = db.query(models.PRThicknessMeasurement).join(models.PRThicknessEquipment)
    
    # 필터 적용
    if equipment_id:
        query = query.filter(models.PRThicknessMeasurement.equipment_id == equipment_id)
    
    if equipment_number:
        query = query.filter(models.PRThicknessEquipment.equipment_number == equipment_number)
    
    if author:
        query = query.filter(models.PRThicknessMeasurement.author.like(f"%{author}%"))
    
    if start_date:
        query = query.filter(models.PRThicknessMeasurement.created_at >= start_date)
    
    if end_date:
        query = query.filter(models.PRThicknessMeasurement.created_at <= end_date)
    
    # 정렬 (최신순)
    query = query.order_by(models.PRThicknessMeasurement.created_at.desc())
    
    # 총 개수
    total = query.count()
    
    # 페이지네이션
    offset = (page - 1) * limit
    measurements = query.offset(offset).limit(limit).all()
    
    return measurements, total


def get_pr_thickness_measurement(db: Session, measurement_id: int):
    """특정 PR Thickness 측정 데이터 조회"""
    return db.query(models.PRThicknessMeasurement).filter(
        models.PRThicknessMeasurement.id == measurement_id
    ).first()


def update_pr_thickness_measurement(
    db: Session, 
    measurement_id: int, 
    measurement: pr_thickness.PRThicknessMeasurementUpdate
):
    """PR Thickness 측정 데이터 업데이트"""
    db_measurement = get_pr_thickness_measurement(db, measurement_id)
    if not db_measurement:
        return None
    
    # 업데이트할 데이터만 적용
    update_data = measurement.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_measurement, key, value)
    
    # 평균값과 범위값 재계산
    values = []
    for position in ['value_top', 'value_center', 'value_bottom', 'value_left', 'value_right']:
        value = getattr(db_measurement, position)
        if value is not None and value > 0:
            values.append(value)
    
    if len(values) >= 3:  # 최소 3개 이상의 값이 있어야 계산
        db_measurement.avg_value = int(sum(values) / len(values))
        db_measurement.range_value = max(values) - min(values)
    else:
        db_measurement.avg_value = None
        db_measurement.range_value = None
    
    # 업데이트 시간 설정
    db_measurement.updated_at = datetime.now()
    
    db.commit()
    db.refresh(db_measurement)
    return db_measurement


def delete_pr_thickness_measurement(db: Session, measurement_id: int):
    """PR Thickness 측정 데이터 삭제"""
    db_measurement = get_pr_thickness_measurement(db, measurement_id)
    if db_measurement:
        db.delete(db_measurement)
        db.commit()
        return True
    return False


def get_pr_thickness_chart_data(
    db: Session, 
    equipment_id: int = None,
    equipment_number: int = None,
    start_date: datetime = None, 
    end_date: datetime = None
):
    """PR Thickness 차트용 데이터 조회"""
    query = db.query(models.PRThicknessMeasurement).join(models.PRThicknessEquipment)
    
    if equipment_id:
        query = query.filter(models.PRThicknessMeasurement.equipment_id == equipment_id)
    
    if equipment_number:
        query = query.filter(models.PRThicknessEquipment.equipment_number == equipment_number)
    
    if start_date:
        query = query.filter(models.PRThicknessMeasurement.created_at >= start_date)
    
    if end_date:
        query = query.filter(models.PRThicknessMeasurement.created_at <= end_date)
    
    # 날짜순 정렬
    measurements = query.order_by(models.PRThicknessMeasurement.created_at.asc()).all()
    
    return measurements


def get_pr_thickness_statistics(db: Session):
    """PR Thickness 통계 데이터 조회"""
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    
    # 오늘 측정 건수
    today_count = db.query(models.PRThicknessMeasurement).filter(
        models.PRThicknessMeasurement.created_at >= today_start
    ).count()
    
    # 이번 주 측정 건수
    week_count = db.query(models.PRThicknessMeasurement).filter(
        models.PRThicknessMeasurement.created_at >= week_start
    ).count()
    
    # 최근 30일 데이터로 평균 계산
    month_ago = now - timedelta(days=30)
    recent_measurements = db.query(models.PRThicknessMeasurement).filter(
        models.PRThicknessMeasurement.created_at >= month_ago,
        models.PRThicknessMeasurement.avg_value.isnot(None)
    ).all()
    
    avg_thickness = 0.0
    avg_uniformity = 0.0
    
    if recent_measurements:
        # 평균 두께 계산
        avg_thickness = sum(m.avg_value for m in recent_measurements) / len(recent_measurements) / 1000.0  # Å to μm
        
        # 평균 균일도 계산 (임시 계산식: 100 - (range/avg * 10))
        uniformities = []
        for m in recent_measurements:
            if m.avg_value and m.range_value is not None:
                uniformity = max(0, 100 - (m.range_value / m.avg_value * 10))
                uniformities.append(uniformity)
        
        if uniformities:
            avg_uniformity = sum(uniformities) / len(uniformities)
    
    return {
        "today_count": today_count,
        "week_count": week_count,
        "avg_thickness": round(avg_thickness, 2),
        "avg_uniformity": round(avg_uniformity, 1)
    }


def bulk_create_pr_thickness_measurements(db: Session, bulk_data: pr_thickness.PRThicknessBulkCreate):
    """PR Thickness 측정 데이터 일괄 생성"""
    created_measurements = []
    
    try:
        for equipment_data in bulk_data.equipment_data:
            # 장비 ID로 장비 정보 조회
            equipment = get_pr_thickness_equipment(db, equipment_data.equipment_id)
            if not equipment:
                continue  # 장비가 없으면 스킵
            
            # 웨이퍼별 측정값 처리 (measurements는 이제 List[MeasurementValues])
            for measurements in equipment_data.measurements:
                # 측정값이 하나라도 있는지 확인
                has_any_measurement = any([
                    measurements.top, measurements.center, measurements.bottom, 
                    measurements.left, measurements.right
                ])
                
                if not has_any_measurement:
                    continue  # 측정값이 없으면 스킵
                
                # 측정 데이터 생성
                measurement_create = pr_thickness.PRThicknessMeasurementCreate(
                    equipment_id=equipment_data.equipment_id,
                    target_thickness=equipment_data.target_thickness,
                    value_top=measurements.top,
                    value_center=measurements.center,
                    value_bottom=measurements.bottom,
                    value_left=measurements.left,
                    value_right=measurements.right,
                    author=bulk_data.author
                )
                
                measurement = create_pr_thickness_measurement(db, measurement_create)
                created_measurements.append(measurement)
        
        return created_measurements
        
    except Exception as e:
        db.rollback()
        raise e


# 변경점 CRUD 함수
def create_change_point(db: Session, change_point_data: change_point.ChangePointCreate):
    db_change_point = models.ChangePoint(
        product_group_id=change_point_data.product_group_id,
        process_id=change_point_data.process_id,
        target_id=change_point_data.target_id,
        change_date=change_point_data.change_date,
        description=change_point_data.description
    )
    db.add(db_change_point)
    db.commit()
    db.refresh(db_change_point)
    return db_change_point


def get_change_points(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ChangePoint).order_by(models.ChangePoint.change_date.desc()).offset(skip).limit(limit).all()


def get_change_points_with_details(db: Session, skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import joinedload
    return (db.query(models.ChangePoint)
            .options(joinedload(models.ChangePoint.product_group))
            .options(joinedload(models.ChangePoint.process))
            .options(joinedload(models.ChangePoint.target))
            .order_by(models.ChangePoint.change_date.desc())
            .offset(skip)
            .limit(limit)
            .all())


def get_change_point(db: Session, change_point_id: int):
    return db.query(models.ChangePoint).filter(models.ChangePoint.id == change_point_id).first()


def get_change_points_by_target(db: Session, target_id: int):
    return (db.query(models.ChangePoint)
            .filter(models.ChangePoint.target_id == target_id)
            .order_by(models.ChangePoint.change_date.desc())
            .all())


def get_change_points_by_date_range(db: Session, start_date: datetime, end_date: datetime):
    return (db.query(models.ChangePoint)
            .filter(models.ChangePoint.change_date >= start_date)
            .filter(models.ChangePoint.change_date <= end_date)
            .order_by(models.ChangePoint.change_date.desc())
            .all())


def get_change_points_by_target_and_date_range(
    db: Session, 
    target_id: int, 
    start_date: datetime = None, 
    end_date: datetime = None
):
    """특정 타겟의 날짜 범위 내 변경점을 조회합니다."""
    query = (db.query(models.ChangePoint)
             .filter(models.ChangePoint.target_id == target_id))
    
    if start_date:
        query = query.filter(models.ChangePoint.change_date >= start_date)
    
    if end_date:
        query = query.filter(models.ChangePoint.change_date <= end_date)
    
    return query.order_by(models.ChangePoint.change_date.asc()).all()


def update_change_point(db: Session, change_point_id: int, change_point_data: change_point.ChangePointUpdate):
    db_change_point = db.query(models.ChangePoint).filter(models.ChangePoint.id == change_point_id).first()
    if db_change_point:
        if change_point_data.product_group_id is not None:
            db_change_point.product_group_id = change_point_data.product_group_id
        if change_point_data.process_id is not None:
            db_change_point.process_id = change_point_data.process_id
        if change_point_data.target_id is not None:
            db_change_point.target_id = change_point_data.target_id
        if change_point_data.change_date is not None:
            db_change_point.change_date = change_point_data.change_date
        if change_point_data.description is not None:
            db_change_point.description = change_point_data.description
        
        db.commit()
        db.refresh(db_change_point)
    return db_change_point


def delete_change_point(db: Session, change_point_id: int):
    db_change_point = db.query(models.ChangePoint).filter(models.ChangePoint.id == change_point_id).first()
    if db_change_point:
        db.delete(db_change_point)
        db.commit()
        return True
    return False
