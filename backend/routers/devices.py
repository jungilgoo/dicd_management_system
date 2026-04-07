from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

from ..database import database
from ..database.models import Measurement, Target

router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
    responses={404: {"description": "Not found"}},
)


# ===== 스키마 =====
class DeviceInfo(BaseModel):
    device: str
    count: int
    first_used: Optional[str] = None
    last_used: Optional[str] = None


class DeviceMergeRequest(BaseModel):
    from_devices: List[str]
    to_device: str
    process_type: Optional[str] = None  # PHOTO/ETCH 안전장치


class DeviceDeleteRequest(BaseModel):
    devices: List[str]
    process_type: Optional[str] = None


# ===== 유틸 =====
def _levenshtein(a: str, b: str) -> int:
    """간단한 Levenshtein 거리 계산"""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(
                cur[-1] + 1,
                prev[j] + 1,
                prev[j - 1] + (ca != cb)
            ))
        prev = cur
    return prev[-1]


def _base_query(db: Session, process_type: Optional[str]):
    q = db.query(Measurement).join(Target, Measurement.target_id == Target.id)
    if process_type:
        q = q.filter(Target.process_type == process_type)
    return q


# ===== API =====
@router.get("/", response_model=List[DeviceInfo])
def list_devices(
    process_type: Optional[str] = Query(None, description="공정 타입 (PHOTO, ETCH)"),
    db: Session = Depends(database.get_db),
):
    """
    DEVICE 목록을 사용 빈도/최초·최근 사용일과 함께 반환합니다.
    빈도 오름차순으로 정렬해 오입력 의심 항목이 상단에 노출됩니다.
    """
    q = (
        db.query(
            Measurement.device.label("device"),
            func.count(Measurement.id).label("count"),
            func.min(Measurement.created_at).label("first_used"),
            func.max(Measurement.created_at).label("last_used"),
        )
        .join(Target, Measurement.target_id == Target.id)
    )
    if process_type:
        q = q.filter(Target.process_type == process_type)

    rows = q.group_by(Measurement.device).order_by(func.count(Measurement.id).asc()).all()

    return [
        DeviceInfo(
            device=r.device,
            count=r.count,
            first_used=r.first_used.isoformat() if r.first_used else None,
            last_used=r.last_used.isoformat() if r.last_used else None,
        )
        for r in rows
    ]


@router.get("/similar")
def find_similar_devices(
    process_type: Optional[str] = Query(None),
    max_distance: int = Query(2, ge=1, le=5, description="유사 판단 편집거리 임계값"),
    db: Session = Depends(database.get_db),
):
    """
    Levenshtein 거리 기반 유사 DEVICE 쌍을 반환합니다.
    빈도가 낮은 쪽이 오타 의심 후보이며, 빈도가 높은 쪽이 표준 후보로 제안됩니다.
    """
    devices = list_devices(process_type=process_type, db=db)
    pairs = []
    n = len(devices)
    for i in range(n):
        for j in range(i + 1, n):
            d1, d2 = devices[i], devices[j]
            dist = _levenshtein(d1.device.upper(), d2.device.upper())
            if 0 < dist <= max_distance:
                # 빈도 낮은 쪽이 의심, 높은 쪽이 표준 제안
                if d1.count <= d2.count:
                    suspect, standard = d1, d2
                else:
                    suspect, standard = d2, d1
                pairs.append({
                    "suspect": suspect.device,
                    "suspect_count": suspect.count,
                    "standard": standard.device,
                    "standard_count": standard.count,
                    "distance": dist,
                })
    # 의심 빈도가 낮은 순 → 거리가 가까운 순
    pairs.sort(key=lambda p: (p["suspect_count"], p["distance"]))
    return pairs


@router.post("/merge")
def merge_devices(
    req: DeviceMergeRequest,
    db: Session = Depends(database.get_db),
):
    """
    잘못된 DEVICE 값들을 올바른 DEVICE로 일괄 변경합니다.
    process_type이 지정되면 해당 공정 타입의 측정값만 대상으로 합니다.
    """
    if not req.from_devices:
        raise HTTPException(status_code=400, detail="변경 대상 DEVICE가 비어 있습니다.")
    if not req.to_device or not req.to_device.strip():
        raise HTTPException(status_code=400, detail="변경할 DEVICE 값이 비어 있습니다.")

    to_device = req.to_device.strip()

    q = _base_query(db, req.process_type).filter(Measurement.device.in_(req.from_devices))
    affected = q.count()

    if affected == 0:
        return {"success": True, "updated_count": 0, "message": "변경 대상 측정값이 없습니다."}

    try:
        # ORM bulk update (synchronize_session=False는 join 업데이트 안전)
        ids = [m.id for m in q.with_entities(Measurement.id).all()]
        db.query(Measurement).filter(Measurement.id.in_(ids)).update(
            {Measurement.device: to_device}, synchronize_session=False
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DEVICE 병합 실패: {e}")

    return {
        "success": True,
        "updated_count": affected,
        "to_device": to_device,
        "from_devices": req.from_devices,
    }


@router.post("/delete")
def delete_devices(
    req: DeviceDeleteRequest,
    db: Session = Depends(database.get_db),
):
    """
    지정한 DEVICE에 해당하는 측정 데이터를 삭제합니다.
    ⚠️ 측정 데이터가 함께 삭제되므로 주의해야 합니다.
    """
    if not req.devices:
        raise HTTPException(status_code=400, detail="삭제 대상 DEVICE가 비어 있습니다.")

    q = _base_query(db, req.process_type).filter(Measurement.device.in_(req.devices))
    ids = [m.id for m in q.with_entities(Measurement.id).all()]

    if not ids:
        return {"success": True, "deleted_count": 0, "message": "삭제 대상 측정값이 없습니다."}

    try:
        db.query(Measurement).filter(Measurement.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DEVICE 삭제 실패: {e}")

    return {"success": True, "deleted_count": len(ids), "devices": req.devices}
