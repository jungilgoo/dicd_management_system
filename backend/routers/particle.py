from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import math

from ..database import crud, database
from ..schemas import particle


router = APIRouter(
    prefix="/api/particle",
    tags=["particle"],
    responses={404: {"description": "Not found"}},
)


# ===== 장비 설정 관련 엔드포인트 =====

@router.get("/equipments", response_model=List[particle.ParticleEquipment])
def get_equipments(db: Session = Depends(database.get_db)):
    """모든 Particle 장비 설정 조회"""
    try:
        equipments = crud.get_particle_equipments(db)
        return equipments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 설정 조회 실패: {str(e)}")


@router.get("/equipments/{equipment_id}", response_model=particle.ParticleEquipment)
def get_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    """특정 Particle 장비 설정 조회"""
    equipment = crud.get_particle_equipment(db, equipment_id=equipment_id)
    if equipment is None:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return equipment


@router.post("/equipments", response_model=particle.ParticleEquipment)
def create_equipment(
    equipment_data: particle.ParticleEquipmentCreate,
    db: Session = Depends(database.get_db)
):
    """Particle 장비 설정 생성"""
    try:
        existing = crud.get_particle_equipment_by_number(db, equipment_data.equipment_number)
        if existing:
            raise HTTPException(status_code=400, detail=f"장비 번호 {equipment_data.equipment_number}는 이미 존재합니다")

        return crud.create_particle_equipment(db=db, equipment=equipment_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 생성 실패: {str(e)}")


@router.put("/equipments/{equipment_id}", response_model=particle.ParticleEquipment)
def update_equipment(
    equipment_id: int,
    equipment_data: particle.ParticleEquipmentUpdate,
    db: Session = Depends(database.get_db)
):
    """Particle 장비 설정 업데이트"""
    try:
        db_equipment = crud.update_particle_equipment(db, equipment_id=equipment_id, equipment=equipment_data)
        if db_equipment is None:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        return db_equipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 업데이트 실패: {str(e)}")


@router.delete("/equipments/{equipment_id}", response_model=bool)
def delete_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    """Particle 장비 삭제"""
    try:
        success = crud.delete_particle_equipment(db, equipment_id=equipment_id)
        if not success:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        return success
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 삭제 실패: {str(e)}")


@router.post("/equipments/bulk", response_model=List[particle.ParticleEquipment])
def bulk_upsert_equipments(
    equipment_settings: particle.ParticleEquipmentSettings,
    db: Session = Depends(database.get_db)
):
    """Particle 장비 설정 일괄 저장 (생성/업데이트)"""
    try:
        results = []
        for equipment_num_str, equipment_data in equipment_settings.settings.items():
            equipment = crud.upsert_particle_equipment(db, equipment_data)
            results.append(equipment)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 설정 저장 실패: {str(e)}")


# ===== 측정 데이터 관련 엔드포인트 =====

@router.post("/measurements", response_model=List[particle.ParticleMeasurement])
def create_measurements(
    bulk_data: particle.ParticleBulkCreate,
    db: Session = Depends(database.get_db)
):
    """Particle 측정 데이터 일괄 생성"""
    try:
        measurements = crud.bulk_create_particle_measurements(db, bulk_data)
        if not measurements:
            raise HTTPException(status_code=400, detail="저장된 측정 데이터가 없습니다. 측정값을 확인해주세요.")
        return measurements
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 저장 실패: {str(e)}")


@router.get("/measurements", response_model=particle.ParticlePaginatedResponse)
def get_measurements(
    equipment_id: Optional[int] = Query(None, description="장비 ID"),
    equipment_number: Optional[int] = Query(None, ge=1, description="장비 번호"),
    author: Optional[str] = Query(None, description="작성자"),
    start_date: Optional[datetime] = Query(None, description="시작일"),
    end_date: Optional[datetime] = Query(None, description="종료일"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(50, ge=1, le=100, description="페이지당 항목 수"),
    db: Session = Depends(database.get_db)
):
    """Particle 측정 데이터 조회 (필터링 및 페이지네이션)"""
    try:
        measurements, total = crud.get_particle_measurements(
            db=db,
            equipment_id=equipment_id,
            equipment_number=equipment_number,
            author=author,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )

        data = []
        for m in measurements:
            data.append(particle.ParticleMeasurementWithEquipment(
                id=m.id,
                equipment_id=m.equipment_id,
                equipment_name=m.equipment.name,
                target_thickness=m.target_thickness,
                top=m.value_top,
                center=m.value_center,
                bottom=m.value_bottom,
                left=m.value_left,
                right=m.value_right,
                avg_value=m.avg_value,
                range_value=m.range_value,
                author=m.author,
                created_at=m.created_at
            ))

        total_pages = math.ceil(total / limit) if total > 0 else 1

        return particle.ParticlePaginatedResponse(
            data=data,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 조회 실패: {str(e)}")


@router.get("/measurements/{measurement_id}", response_model=particle.ParticleMeasurement)
def get_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    """특정 Particle 측정 데이터 조회"""
    measurement = crud.get_particle_measurement(db, measurement_id=measurement_id)
    if measurement is None:
        raise HTTPException(status_code=404, detail="측정 데이터를 찾을 수 없습니다")
    return measurement


@router.put("/measurements/{measurement_id}", response_model=particle.ParticleMeasurement)
def update_measurement(
    measurement_id: int,
    measurement_data: particle.ParticleMeasurementUpdate,
    db: Session = Depends(database.get_db)
):
    """Particle 측정 데이터 업데이트"""
    try:
        updated_measurement = crud.update_particle_measurement(
            db, measurement_id=measurement_id, measurement=measurement_data
        )
        if updated_measurement is None:
            raise HTTPException(status_code=404, detail="측정 데이터를 찾을 수 없습니다")
        return updated_measurement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 업데이트 실패: {str(e)}")


@router.delete("/measurements/{measurement_id}", response_model=bool)
def delete_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    """Particle 측정 데이터 삭제"""
    try:
        success = crud.delete_particle_measurement(db, measurement_id=measurement_id)
        if not success:
            raise HTTPException(status_code=404, detail="측정 데이터를 찾을 수 없습니다")
        return success
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 삭제 실패: {str(e)}")


# ===== 차트 데이터 엔드포인트 =====

@router.get("/chart-data", response_model=particle.ParticleChartData)
def get_chart_data(
    equipment_id: Optional[int] = Query(None, description="장비 ID"),
    equipment_number: Optional[int] = Query(None, ge=1, description="장비 번호"),
    period: str = Query("30d", description="기간 (7d, 30d, 90d, custom)"),
    start_date: Optional[datetime] = Query(None, description="사용자 지정 시작일 (period=custom일 때)"),
    end_date: Optional[datetime] = Query(None, description="사용자 지정 종료일 (period=custom일 때)"),
    db: Session = Depends(database.get_db)
):
    """Particle 차트용 데이터 조회"""
    try:
        if period == "custom":
            if not start_date or not end_date:
                raise HTTPException(status_code=400, detail="사용자 지정 기간에는 시작일과 종료일이 필요합니다")
        else:
            now = datetime.now()
            if period == "7d":
                start_date = now - timedelta(days=7)
            elif period == "30d":
                start_date = now - timedelta(days=30)
            elif period == "90d":
                start_date = now - timedelta(days=90)
            else:
                raise HTTPException(status_code=400, detail="지원하지 않는 기간입니다")
            end_date = now

        if equipment_id:
            equipment = crud.get_particle_equipment(db, equipment_id)
        elif equipment_number:
            equipment = crud.get_particle_equipment_by_number(db, equipment_number)
        else:
            equipment = crud.get_particle_equipment_by_number(db, 1)

        if not equipment:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")

        measurements = crud.get_particle_chart_data(
            db=db,
            equipment_id=equipment.id,
            start_date=start_date,
            end_date=end_date
        )

        labels = []
        data = []
        target_line = []
        spec_min_line = []
        spec_max_line = []

        measurements_sorted = sorted(measurements, key=lambda x: x.created_at)

        for m in measurements_sorted:
            if m.avg_value is not None:
                date_label = m.created_at.strftime("%m/%d")
                labels.append(date_label)
                data.append(int(m.avg_value))
                target_line.append(equipment.target_thickness)
                spec_min_line.append(equipment.spec_min)
                spec_max_line.append(equipment.spec_max)

        return particle.ParticleChartData(
            labels=labels,
            data=data,
            target_line=target_line,
            spec_min_line=spec_min_line,
            spec_max_line=spec_max_line,
            equipment_name=equipment.name
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"차트 데이터 조회 실패: {str(e)}")


# ===== 통계 데이터 엔드포인트 =====

@router.get("/statistics", response_model=particle.ParticleStatistics)
def get_statistics(db: Session = Depends(database.get_db)):
    """Particle 통계 데이터 조회"""
    try:
        stats = crud.get_particle_statistics(db)
        return particle.ParticleStatistics(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 데이터 조회 실패: {str(e)}")


# ===== 초기 설정 엔드포인트 =====

@router.post("/initialize", response_model=List[particle.ParticleEquipment])
def initialize_equipments(db: Session = Depends(database.get_db)):
    """Particle 장비 기본 설정 (최소 3개 장비 생성)"""
    try:
        existing_equipments = crud.get_particle_equipments(db)
        if existing_equipments:
            return existing_equipments

        default_equipments = [
            {"equipment_number": 1, "name": "장비1", "target": 25000, "spec_min": 24000, "spec_max": 26000},
            {"equipment_number": 2, "name": "장비2", "target": 24500, "spec_min": 23500, "spec_max": 25500},
            {"equipment_number": 3, "name": "장비3", "target": 25500, "spec_min": 24500, "spec_max": 26500},
        ]

        results = []
        for equipment_data in default_equipments:
            equipment_create = particle.ParticleEquipmentCreate(
                equipment_number=equipment_data["equipment_number"],
                name=equipment_data["name"],
                target_thickness=equipment_data["target"],
                spec_min=equipment_data["spec_min"],
                spec_max=equipment_data["spec_max"]
            )
            equipment = crud.upsert_particle_equipment(db, equipment_create)
            results.append(equipment)

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 초기화 실패: {str(e)}")
