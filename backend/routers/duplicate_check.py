from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, List
from ..database import crud, models, database

router = APIRouter(
    prefix="/api/duplicate-check",
    tags=["duplicate-check"],
)

@router.get("/", response_model=Dict[str, bool])
async def check_duplicate_measurement(
    target_id: int = Query(...),
    lot_no: str = Query(...),
    wafer_no: str = Query(...),
    db: Session = Depends(database.get_db)
):
    print(f"Received params: target_id={target_id}, lot_no={lot_no}, wafer_no={wafer_no}")
    existing = crud.check_duplicate_measurement(
        db, target_id=target_id, lot_no=lot_no, wafer_no=wafer_no
    )
    return {"isDuplicate": existing}


@router.get("/list")
async def list_duplicate_measurements(
    process_type: str = Query("PHOTO", description="공정 타입 (PHOTO, ETCH)"),
    db: Session = Depends(database.get_db)
):
    """
    중복된 (타겟, LOT NO, WAFER NO) 조합의 측정 데이터를 모두 반환
    같은 그룹 내 첫 번째(가장 오래된) 데이터가 원본, 이후 데이터가 중복
    """
    measurements = crud.get_duplicate_measurements(db, process_type=process_type)

    if not measurements:
        return {"items": [], "total_count": 0, "group_count": 0}

    # 배치 조회로 관련 정보 수집
    target_ids = list(set(m.target_id for m in measurements))
    equip_ids = set()
    for m in measurements:
        for eid in (m.coating_equipment_id, m.exposure_equipment_id,
                    m.development_equipment_id, m.etch_equipment_id):
            if eid:
                equip_ids.add(eid)

    targets = db.query(models.Target).filter(models.Target.id.in_(target_ids)).all()
    targets_map = {t.id: t for t in targets}

    process_ids = list(set(t.process_id for t in targets if t.process_id))
    processes_map = {}
    product_groups_map = {}
    if process_ids:
        processes = db.query(models.Process).filter(models.Process.id.in_(process_ids)).all()
        processes_map = {p.id: p for p in processes}
        pg_ids = list(set(p.product_group_id for p in processes if p.product_group_id))
        if pg_ids:
            pgs = db.query(models.ProductGroup).filter(models.ProductGroup.id.in_(pg_ids)).all()
            product_groups_map = {pg.id: pg for pg in pgs}

    equipments_map = {}
    if equip_ids:
        equips = db.query(models.Equipment).filter(models.Equipment.id.in_(list(equip_ids))).all()
        equipments_map = {e.id: e for e in equips}

    specs = db.query(models.Spec).filter(
        models.Spec.target_id.in_(target_ids),
        models.Spec.is_active == True
    ).all()
    active_specs = {s.target_id: s for s in specs}

    # 그룹별 첫 번째(원본) ID 추적 - created_at 기준 가장 오래된 것이 원본
    group_first_id = {}
    for m in measurements:
        key = (m.target_id, m.lot_no, m.wafer_no)
        if key not in group_first_id:
            group_first_id[key] = m.id

    result = []
    for m in measurements:
        target = targets_map.get(m.target_id)
        process = processes_map.get(target.process_id) if target else None
        pg = product_groups_map.get(process.product_group_id) if process else None
        spec = active_specs.get(m.target_id)
        key = (m.target_id, m.lot_no, m.wafer_no)

        item = {
            "id": m.id,
            "target_id": m.target_id,
            "spec_id": m.spec_id,
            "coating_equipment_id": m.coating_equipment_id,
            "exposure_equipment_id": m.exposure_equipment_id,
            "development_equipment_id": m.development_equipment_id,
            "etch_equipment_id": m.etch_equipment_id,
            "device": m.device,
            "lot_no": m.lot_no,
            "wafer_no": m.wafer_no,
            "exposure_time": m.exposure_time,
            "value_top": m.value_top,
            "value_center": m.value_center,
            "value_bottom": m.value_bottom,
            "value_left": m.value_left,
            "value_right": m.value_right,
            "avg_value": m.avg_value,
            "min_value": m.min_value,
            "max_value": m.max_value,
            "range_value": m.range_value,
            "std_dev": m.std_dev,
            "author": m.author,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
            "target_name": target.name if target else None,
            "process_name": process.name if process else None,
            "product_group_name": pg.name if pg else None,
            "coating_equipment_name": equipments_map[m.coating_equipment_id].name if m.coating_equipment_id and m.coating_equipment_id in equipments_map else None,
            "exposure_equipment_name": equipments_map[m.exposure_equipment_id].name if m.exposure_equipment_id and m.exposure_equipment_id in equipments_map else None,
            "development_equipment_name": equipments_map[m.development_equipment_id].name if m.development_equipment_id and m.development_equipment_id in equipments_map else None,
            "etch_equipment_name": equipments_map[m.etch_equipment_id].name if m.etch_equipment_id and m.etch_equipment_id in equipments_map else None,
            "spec_lsl": spec.lsl if spec else None,
            "spec_usl": spec.usl if spec else None,
            "is_original": m.id == group_first_id[key],
        }
        result.append(item)

    return {
        "items": result,
        "total_count": len(result),
        "group_count": len(group_first_id)
    }