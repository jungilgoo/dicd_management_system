from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from ..database import crud, models, database
from ..schemas import measurement

router = APIRouter(
    prefix="/api/measurements",
    tags=["measurements"],
    responses={404: {"description": "Not found"}},
)

@router.get("/check-device")
def check_device_exists(
    device: str = Query(..., description="확인할 DEVICE명"),
    db: Session = Depends(database.get_db)
):
    """
    DEVICE명이 기존 측정 데이터에 존재하는지 확인합니다.
    """
    exists = crud.check_device_exists(db, device=device)
    return {"exists": exists, "device": device}


@router.post("/", response_model=measurement.Measurement)
def create_measurement(
    measurement_data: measurement.MeasurementCreate, db: Session = Depends(database.get_db)
):
    return crud.create_measurement(db=db, measurement_data=measurement_data)

# backend/routers/measurements.py 파일의 read_measurements 함수 업데이트

@router.get("/", response_model=List[measurement.MeasurementListItem])
def read_measurements(
    target_id: Optional[int] = None,
    process_id: Optional[int] = None,
    product_group_id: Optional[int] = None,
    device: Optional[str] = None,
    lot_no: Optional[str] = None,
    days: Optional[int] = Query(7, description="최근 일수 (기본 1주)"),
    start_date: Optional[str] = None,  # 문자열로 날짜 받기 추가
    end_date: Optional[str] = None,    # 문자열로 날짜 받기 추가
    equipment_id: Optional[int] = None,
    keyword: Optional[str] = None,
    process_type: str = Query("PHOTO", description="공정 타입 (PHOTO, ETCH)"),
    db: Session = Depends(database.get_db)
):
    # 날짜 처리 로직 수정
    start_datetime = None

    # 문자열 날짜가 제공된 경우 datetime으로 변환
    if start_date and end_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일은 해당 일자의 마지막 시간으로 설정
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    elif days:
        # 기존 로직: 일수 기준으로 시작 날짜 계산
        start_datetime = datetime.now() - timedelta(days=days)
        end_datetime = None

    measurements = crud.get_measurements(
        db,
        target_id=target_id,
        process_id=process_id,
        product_group_id=product_group_id,
        device=device,
        lot_no=lot_no,
        start_date=start_datetime,  # 변환된 datetime 사용
        end_date=end_datetime if 'end_datetime' in locals() else None,  # 변환된 datetime 사용
        equipment_id=equipment_id,
        keyword=keyword,
        process_type=process_type,
    )

    # 배치 쿼리용 ID 수집
    target_ids = list(set(m.target_id for m in measurements))
    equip_ids = set()
    for m in measurements:
        for eid in (m.coating_equipment_id, m.exposure_equipment_id,
                    m.development_equipment_id, m.etch_equipment_id):
            if eid:
                equip_ids.add(eid)

    # 배치 쿼리: 타겟, 공정, 제품군, 장비, SPEC (ORM relationship 접근 없이)
    targets_map = {}
    processes_map = {}
    product_groups_map = {}
    equipments_map = {}
    active_specs = {}

    if target_ids:
        targets = db.query(models.Target).filter(models.Target.id.in_(target_ids)).all()
        targets_map = {t.id: t for t in targets}

        process_ids = list(set(t.process_id for t in targets if t.process_id))
        if process_ids:
            processes = db.query(models.Process).filter(models.Process.id.in_(process_ids)).all()
            processes_map = {p.id: p for p in processes}

            pg_ids = list(set(p.product_group_id for p in processes if p.product_group_id))
            if pg_ids:
                pgs = db.query(models.ProductGroup).filter(models.ProductGroup.id.in_(pg_ids)).all()
                product_groups_map = {pg.id: pg for pg in pgs}

        specs = db.query(models.Spec).filter(
            models.Spec.target_id.in_(target_ids),
            models.Spec.is_active == True
        ).all()
        for s in specs:
            active_specs[s.target_id] = s

    if equip_ids:
        equips = db.query(models.Equipment).filter(models.Equipment.id.in_(list(equip_ids))).all()
        equipments_map = {e.id: e for e in equips}

    # enriched 응답 구성 (딕셔너리 룩업만 사용, ORM relationship 접근 없음)
    result = []
    for m in measurements:
        item = measurement.Measurement.from_orm(m).dict()
        target = targets_map.get(m.target_id)
        process = processes_map.get(target.process_id) if target else None
        pg = product_groups_map.get(process.product_group_id) if process else None

        item["target_name"] = target.name if target else None
        item["process_name"] = process.name if process else None
        item["product_group_name"] = pg.name if pg else None
        item["coating_equipment_name"] = equipments_map[m.coating_equipment_id].name if m.coating_equipment_id and m.coating_equipment_id in equipments_map else None
        item["exposure_equipment_name"] = equipments_map[m.exposure_equipment_id].name if m.exposure_equipment_id and m.exposure_equipment_id in equipments_map else None
        item["development_equipment_name"] = equipments_map[m.development_equipment_id].name if m.development_equipment_id and m.development_equipment_id in equipments_map else None
        item["etch_equipment_name"] = equipments_map[m.etch_equipment_id].name if m.etch_equipment_id and m.etch_equipment_id in equipments_map else None
        spec = active_specs.get(m.target_id)
        item["spec_lsl"] = spec.lsl if spec else None
        item["spec_usl"] = spec.usl if spec else None
        result.append(item)

    return result

@router.get("/{measurement_id}", response_model=measurement.MeasurementWithSpec)
def read_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    db_measurement = crud.get_measurement(db, measurement_id=measurement_id)
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    # SPEC 상태 확인
    spec_status = crud.check_spec_status(db, measurement_id=measurement_id)
    
    # 응답 모델 생성
    result = measurement.Measurement.from_orm(db_measurement)
    result_dict = result.dict()
    result_dict["spec_status"] = spec_status
    
    return result_dict

@router.put("/{measurement_id}", response_model=measurement.Measurement)
def update_measurement(
    measurement_id: int, 
    measurement_data: measurement.MeasurementCreate, 
    db: Session = Depends(database.get_db)
):
    db_measurement = crud.update_measurement(db, measurement_id=measurement_id, measurement_data=measurement_data)
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return db_measurement

@router.delete("/{measurement_id}", response_model=bool)
def delete_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_measurement(db, measurement_id=measurement_id)
    if not success:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return success


@router.post("/bulk-delete", response_model=measurement.MeasurementBulkDeleteResponse)
def bulk_delete_measurements(
    request: measurement.MeasurementBulkDeleteRequest,
    db: Session = Depends(database.get_db)
):
    """
    여러 측정 데이터를 일괄 삭제합니다.
    최대 100개까지 허용됩니다.
    """
    if not request.measurement_ids:
        raise HTTPException(status_code=400, detail="삭제할 데이터를 선택해주세요.")

    if len(request.measurement_ids) > 100:
        raise HTTPException(status_code=400, detail="한 번에 최대 100개까지만 삭제할 수 있습니다.")

    deleted_count = crud.delete_measurements_bulk(db, request.measurement_ids)

    return measurement.MeasurementBulkDeleteResponse(
        success=True,
        deleted_count=deleted_count,
        message=f"{deleted_count}개의 측정 데이터가 삭제되었습니다."
    )
