from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import math

from ..database import crud, database
from ..schemas import pr_thickness


router = APIRouter(
    prefix="/api/pr-thickness",
    tags=["pr-thickness"],
    responses={404: {"description": "Not found"}},
)


# ===== 장비 설정 관련 엔드포인트 =====

@router.get("/equipments", response_model=List[pr_thickness.PRThicknessEquipment])
def get_equipments(db: Session = Depends(database.get_db)):
    """모든 PR Thickness 장비 설정 조회"""
    try:
        equipments = crud.get_pr_thickness_equipments(db)
        return equipments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 설정 조회 실패: {str(e)}")


@router.get("/equipments/{equipment_id}", response_model=pr_thickness.PRThicknessEquipment)
def get_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    """특정 PR Thickness 장비 설정 조회"""
    equipment = crud.get_pr_thickness_equipment(db, equipment_id=equipment_id)
    if equipment is None:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return equipment


@router.post("/equipments", response_model=pr_thickness.PRThicknessEquipment)
def create_equipment(
    equipment_data: pr_thickness.PRThicknessEquipmentCreate, 
    db: Session = Depends(database.get_db)
):
    """PR Thickness 장비 설정 생성"""
    try:
        # 장비 번호 중복 확인
        existing = crud.get_pr_thickness_equipment_by_number(db, equipment_data.equipment_number)
        if existing:
            raise HTTPException(status_code=400, detail=f"장비 번호 {equipment_data.equipment_number}는 이미 존재합니다")
        
        return crud.create_pr_thickness_equipment(db=db, equipment=equipment_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 생성 실패: {str(e)}")


@router.put("/equipments/{equipment_id}", response_model=pr_thickness.PRThicknessEquipment)
def update_equipment(
    equipment_id: int,
    equipment_data: pr_thickness.PRThicknessEquipmentUpdate, 
    db: Session = Depends(database.get_db)
):
    """PR Thickness 장비 설정 업데이트"""
    try:
        db_equipment = crud.update_pr_thickness_equipment(db, equipment_id=equipment_id, equipment=equipment_data)
        if db_equipment is None:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        return db_equipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 업데이트 실패: {str(e)}")


@router.delete("/equipments/{equipment_id}", response_model=bool)
def delete_equipment(equipment_id: int, db: Session = Depends(database.get_db)):
    """PR Thickness 장비 삭제"""
    try:
        success = crud.delete_pr_thickness_equipment(db, equipment_id=equipment_id)
        if not success:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        return success
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 삭제 실패: {str(e)}")


@router.post("/equipments/bulk", response_model=List[pr_thickness.PRThicknessEquipment])
def bulk_upsert_equipments(
    equipment_settings: pr_thickness.PRThicknessEquipmentSettings,
    db: Session = Depends(database.get_db)
):
    """PR Thickness 장비 설정 일괄 저장 (생성/업데이트)"""
    try:
        results = []
        for equipment_num_str, equipment_data in equipment_settings.settings.items():
            equipment = crud.upsert_pr_thickness_equipment(db, equipment_data)
            results.append(equipment)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 설정 저장 실패: {str(e)}")


# ===== 측정 데이터 관련 엔드포인트 =====

@router.post("/measurements", response_model=List[pr_thickness.PRThicknessMeasurement])
def create_measurements(
    bulk_data: pr_thickness.PRThicknessBulkCreate,
    db: Session = Depends(database.get_db)
):
    """PR Thickness 측정 데이터 일괄 생성"""
    try:
        measurements = crud.bulk_create_pr_thickness_measurements(db, bulk_data)
        if not measurements:
            raise HTTPException(status_code=400, detail="저장된 측정 데이터가 없습니다. 측정값을 확인해주세요.")
        return measurements
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 저장 실패: {str(e)}")


@router.get("/measurements", response_model=pr_thickness.PRThicknessPaginatedResponse)
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
    """PR Thickness 측정 데이터 조회 (필터링 및 페이지네이션)"""
    try:
        measurements, total = crud.get_pr_thickness_measurements(
            db=db,
            equipment_id=equipment_id,
            equipment_number=equipment_number,
            author=author,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )
        
        # 응답용 데이터 변환
        data = []
        for m in measurements:
            data.append(pr_thickness.PRThicknessMeasurementWithEquipment(
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
        
        return pr_thickness.PRThicknessPaginatedResponse(
            data=data,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 조회 실패: {str(e)}")


@router.get("/measurements/{measurement_id}", response_model=pr_thickness.PRThicknessMeasurement)
def get_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    """특정 PR Thickness 측정 데이터 조회"""
    measurement = crud.get_pr_thickness_measurement(db, measurement_id=measurement_id)
    if measurement is None:
        raise HTTPException(status_code=404, detail="측정 데이터를 찾을 수 없습니다")
    return measurement


@router.put("/measurements/{measurement_id}", response_model=pr_thickness.PRThicknessMeasurement)
def update_measurement(
    measurement_id: int,
    measurement_data: pr_thickness.PRThicknessMeasurementUpdate,
    db: Session = Depends(database.get_db)
):
    """PR Thickness 측정 데이터 업데이트"""
    try:
        updated_measurement = crud.update_pr_thickness_measurement(
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
    """PR Thickness 측정 데이터 삭제"""
    try:
        success = crud.delete_pr_thickness_measurement(db, measurement_id=measurement_id)
        if not success:
            raise HTTPException(status_code=404, detail="측정 데이터를 찾을 수 없습니다")
        return success
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 데이터 삭제 실패: {str(e)}")


# ===== 차트 데이터 엔드포인트 =====

@router.get("/chart-data", response_model=pr_thickness.PRThicknessChartData)
def get_chart_data(
    equipment_id: Optional[int] = Query(None, description="장비 ID"),
    equipment_number: Optional[int] = Query(None, ge=1, description="장비 번호"),
    period: str = Query("30d", description="기간 (7d, 30d, 90d, custom)"),
    start_date: Optional[datetime] = Query(None, description="사용자 지정 시작일 (period=custom일 때)"),
    end_date: Optional[datetime] = Query(None, description="사용자 지정 종료일 (period=custom일 때)"),
    db: Session = Depends(database.get_db)
):
    """PR Thickness 차트용 데이터 조회"""
    try:
        # 기간 설정
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
        
        # 장비 정보 조회
        if equipment_id:
            equipment = crud.get_pr_thickness_equipment(db, equipment_id)
        elif equipment_number:
            equipment = crud.get_pr_thickness_equipment_by_number(db, equipment_number)
        else:
            # 기본적으로 장비1 사용
            equipment = crud.get_pr_thickness_equipment_by_number(db, 1)
        
        if not equipment:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        
        # 측정 데이터 조회
        measurements = crud.get_pr_thickness_chart_data(
            db=db,
            equipment_id=equipment.id,
            start_date=start_date,
            end_date=end_date
        )
        
        # 차트 데이터 생성
        labels = []
        data = []
        target_line = []
        spec_min_line = []
        spec_max_line = []
        
        # 측정 시간순으로 정렬
        measurements_sorted = sorted(measurements, key=lambda x: x.created_at)
        
        # 각 측정값을 개별 데이터 포인트로 표시
        for m in measurements_sorted:
            if m.avg_value is not None:
                # 날짜만 표시 (시간 제외)
                date_label = m.created_at.strftime("%m/%d")
                labels.append(date_label)
                data.append(int(m.avg_value))
                target_line.append(equipment.target_thickness)
                spec_min_line.append(equipment.spec_min)
                spec_max_line.append(equipment.spec_max)
        
        return pr_thickness.PRThicknessChartData(
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

@router.get("/statistics", response_model=pr_thickness.PRThicknessStatistics)
def get_statistics(db: Session = Depends(database.get_db)):
    """PR Thickness 통계 데이터 조회"""
    try:
        stats = crud.get_pr_thickness_statistics(db)
        return pr_thickness.PRThicknessStatistics(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 데이터 조회 실패: {str(e)}")


# ===== 초기 설정 엔드포인트 =====

@router.post("/initialize", response_model=List[pr_thickness.PRThicknessEquipment])
def initialize_equipments(db: Session = Depends(database.get_db)):
    """PR Thickness 장비 기본 설정 (최소 3개 장비 생성)"""
    try:
        # 기존 장비가 있는지 확인
        existing_equipments = crud.get_pr_thickness_equipments(db)
        if existing_equipments:
            return existing_equipments
        
        # 기본 장비 설정 (처음 설치시에만)
        default_equipments = [
            {"equipment_number": 1, "name": "장비1", "target": 25000, "spec_min": 24000, "spec_max": 26000},
            {"equipment_number": 2, "name": "장비2", "target": 24500, "spec_min": 23500, "spec_max": 25500},
            {"equipment_number": 3, "name": "장비3", "target": 25500, "spec_min": 24500, "spec_max": 26500},
        ]
        
        results = []
        for equipment_data in default_equipments:
            equipment_create = pr_thickness.PRThicknessEquipmentCreate(
                equipment_number=equipment_data["equipment_number"],
                name=equipment_data["name"],
                target_thickness=equipment_data["target"],
                spec_min=equipment_data["spec_min"],
                spec_max=equipment_data["spec_max"]
            )
            equipment = crud.upsert_pr_thickness_equipment(db, equipment_create)
            results.append(equipment)
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 초기화 실패: {str(e)}")