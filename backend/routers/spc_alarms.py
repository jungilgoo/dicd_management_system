from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import database, models
from ..schemas import spc_alarm as schemas

router = APIRouter(
    prefix="/api/spc-alarms",
    tags=["spc-alarms"],
    responses={404: {"description": "Not found"}},
)


@router.get("/summary", response_model=schemas.SpcAlarmSummary)
def get_alarm_summary(
    process_type: Optional[str] = Query('PHOTO', description="공정 타입 (PHOTO, ETCH)"),
    db: Session = Depends(database.get_db)
):
    """대시보드용 알람 요약 (severity별 ACTIVE 건수)"""
    query = db.query(
        models.SpcAlarm.severity,
        func.count(models.SpcAlarm.id)
    ).filter(
        models.SpcAlarm.status == 'ACTIVE'
    )

    # process_type 필터링
    if process_type:
        query = query.join(
            models.Target, models.SpcAlarm.target_id == models.Target.id
        ).filter(models.Target.process_type == process_type)

    counts = query.group_by(models.SpcAlarm.severity).all()

    summary = {"critical_count": 0, "warning_count": 0, "info_count": 0, "total_count": 0}
    for severity, count in counts:
        if severity == 'CRITICAL':
            summary["critical_count"] = count
        elif severity == 'WARNING':
            summary["warning_count"] = count
        elif severity == 'INFO':
            summary["info_count"] = count
    summary["total_count"] = sum([summary["critical_count"], summary["warning_count"], summary["info_count"]])

    return summary


@router.get("/", response_model=List[schemas.SpcAlarmListItem])
def get_alarms(
    target_id: Optional[int] = None,
    severity: Optional[str] = None,
    status: Optional[str] = Query(None, description="알람 상태 (ACTIVE, RESOLVED, SUPERSEDED). 미지정 시 전체"),
    process_type: Optional[str] = Query('PHOTO', description="공정 타입"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(database.get_db)
):
    """알람 목록 조회"""
    query = db.query(models.SpcAlarm).join(
        models.Target, models.SpcAlarm.target_id == models.Target.id
    )

    if process_type:
        query = query.filter(models.Target.process_type == process_type)
    if target_id:
        query = query.filter(models.SpcAlarm.target_id == target_id)
    if severity:
        query = query.filter(models.SpcAlarm.severity == severity)
    if status:
        query = query.filter(models.SpcAlarm.status == status)
    if start_date:
        try:
            dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(models.SpcAlarm.created_at >= dt)
        except ValueError:
            pass
    if end_date:
        try:
            dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(models.SpcAlarm.created_at <= dt)
        except ValueError:
            pass

    alarms = query.order_by(
        models.SpcAlarm.created_at.desc()
    ).offset(offset).limit(limit).all()

    # 제품군/공정/타겟명, device, lot_no 추가
    result = []
    for alarm in alarms:
        item = schemas.SpcAlarmListItem.model_validate(alarm)
        if alarm.target:
            item.target_name = alarm.target.name
            if alarm.target.process:
                item.process_id = alarm.target.process.id
                item.process_name = alarm.target.process.name
                if alarm.target.process.product_group:
                    item.product_group_id = alarm.target.process.product_group.id
                    item.product_group_name = alarm.target.process.product_group.name
        if alarm.measurement:
            item.device = alarm.measurement.device
            item.lot_no = alarm.measurement.lot_no
        result.append(item)

    return result


@router.get("/{alarm_id}", response_model=schemas.SpcAlarm)
def get_alarm(alarm_id: int, db: Session = Depends(database.get_db)):
    """알람 상세 조회"""
    alarm = db.query(models.SpcAlarm).filter(models.SpcAlarm.id == alarm_id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="알람을 찾을 수 없습니다.")
    return alarm


@router.post("/resolve-all")
def resolve_all_alarms(
    process_type: Optional[str] = Query('PHOTO', description="공정 타입"),
    target_id: Optional[int] = None,
    severity: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    """현재 필터 조건의 ACTIVE 알람을 일괄 조치 완료 처리"""
    # JOIN 포함 쿼리는 update() 불가 → ID 먼저 수집 후 업데이트
    id_query = db.query(models.SpcAlarm.id).join(
        models.Target, models.SpcAlarm.target_id == models.Target.id
    ).filter(models.SpcAlarm.status == 'ACTIVE')

    if process_type:
        id_query = id_query.filter(models.Target.process_type == process_type)
    if target_id:
        id_query = id_query.filter(models.SpcAlarm.target_id == target_id)
    if severity:
        id_query = id_query.filter(models.SpcAlarm.severity == severity)

    alarm_ids = [row[0] for row in id_query.all()]
    if not alarm_ids:
        return {"resolved_count": 0}

    now = datetime.now()
    updated = db.query(models.SpcAlarm).filter(
        models.SpcAlarm.id.in_(alarm_ids)
    ).update({
        models.SpcAlarm.status: 'RESOLVED',
        models.SpcAlarm.resolved_by: '담당자',
        models.SpcAlarm.resolved_at: now,
        models.SpcAlarm.resolve_note: '전체 해결 처리'
    }, synchronize_session=False)
    db.commit()
    return {"resolved_count": updated}


@router.patch("/{alarm_id}/resolve", response_model=schemas.SpcAlarm)
def resolve_alarm(
    alarm_id: int,
    data: schemas.SpcAlarmResolve,
    db: Session = Depends(database.get_db)
):
    """알람 조치 완료 처리 (ACTIVE → RESOLVED)"""
    alarm = db.query(models.SpcAlarm).filter(models.SpcAlarm.id == alarm_id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="알람을 찾을 수 없습니다.")
    if alarm.status not in ('ACTIVE', 'ACKNOWLEDGED'):
        raise HTTPException(status_code=400, detail=f"ACTIVE 상태의 알람만 조치 완료할 수 있습니다. (현재: {alarm.status})")

    alarm.status = 'RESOLVED'
    alarm.resolved_by = '담당자'
    alarm.resolved_at = datetime.now()
    if data.resolve_note:
        alarm.resolve_note = data.resolve_note
    db.commit()
    db.refresh(alarm)
    return alarm
