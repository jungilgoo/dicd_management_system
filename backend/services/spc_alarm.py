"""
SPC 알람 판정 서비스

측정 데이터 입력/수정 시 실시간으로 이상치를 판정하고 알람을 생성한다.

판정 항목:
- 스펙(USL/LSL) 초과: 개별 측정값 + 평균값 → CRITICAL
- R차트 UCL 초과: range_value가 R_UCL 초과 → CRITICAL
- Nelson Rule 1: 3σ 이탈 → CRITICAL
- Nelson Rule 2: 9점 연속 같은 쪽 → WARNING
- Nelson Rule 3: 6점 연속 증감 → WARNING
"""
import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from ..database import models
from .spc import detect_nelson_rules, calculate_control_limits

logger = logging.getLogger(__name__)

# X-bar R 관리도 상수표 (서브그룹 크기별)
CONTROL_CHART_CONSTANTS = {
    2: {"A2": 1.880, "D3": 0, "D4": 3.267, "d2": 1.128},
    3: {"A2": 1.023, "D3": 0, "D4": 2.574, "d2": 1.693},
    4: {"A2": 0.729, "D3": 0, "D4": 2.282, "d2": 2.059},
    5: {"A2": 0.577, "D3": 0, "D4": 2.114, "d2": 2.326},
    6: {"A2": 0.483, "D3": 0, "D4": 2.004, "d2": 2.534},
}
SUBGROUP_SIZE = 5


def evaluate_measurement_alarms(db: Session, measurement_id: int) -> List[models.SpcAlarm]:
    """
    측정 생성/수정 후 호출되는 메인 판정 함수.
    스펙 초과, R차트, Nelson Rule을 순차 판정하고 알람 레코드를 생성한다.
    """
    measurement = db.query(models.Measurement).filter(
        models.Measurement.id == measurement_id
    ).first()

    if not measurement:
        logger.warning(f"측정 ID {measurement_id}를 찾을 수 없습니다.")
        return []

    target_id = measurement.target_id

    # 활성 SPEC 조회
    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()

    alarms = []

    # 1. 스펙(USL/LSL) 초과 판정
    if active_spec:
        alarms.extend(_check_spec_exceedance(measurement, active_spec, target_id))

    # 2. R차트 UCL 초과 판정
    alarms.extend(_check_r_chart(db, measurement, target_id))

    # 3. Nelson Rule 판정 (Rule 1, 2, 3만)
    alarms.extend(_check_nelson_rules(db, measurement, target_id, active_spec))

    # 알람 레코드 DB 저장
    for alarm in alarms:
        db.add(alarm)

    if alarms:
        db.commit()
        logger.info(f"측정 ID {measurement_id}: {len(alarms)}건 알람 생성")

    return alarms


def _check_spec_exceedance(
    measurement: models.Measurement,
    spec: models.Spec,
    target_id: int
) -> List[models.SpcAlarm]:
    """개별 측정값 5개 + 평균값에 대해 USL/LSL 초과 확인"""
    alarms = []

    position_values = {
        "Top": measurement.value_top,
        "Center": measurement.value_center,
        "Bottom": measurement.value_bottom,
        "Left": measurement.value_left,
        "Right": measurement.value_right,
    }

    # 개별 위치값 판정
    for position, value in position_values.items():
        if value is None:
            continue
        if value > spec.usl:
            alarms.append(_create_alarm(
                measurement_id=measurement.id,
                target_id=target_id,
                alarm_type='SPEC',
                severity='CRITICAL',
                description=f'{position} 값 USL 초과 ({value} > {spec.usl})',
                value=value,
                spec=spec,
            ))
        elif value < spec.lsl:
            alarms.append(_create_alarm(
                measurement_id=measurement.id,
                target_id=target_id,
                alarm_type='SPEC',
                severity='CRITICAL',
                description=f'{position} 값 LSL 미달 ({value} < {spec.lsl})',
                value=value,
                spec=spec,
            ))

    # 평균값 판정
    if measurement.avg_value is not None:
        if measurement.avg_value > spec.usl:
            alarms.append(_create_alarm(
                measurement_id=measurement.id,
                target_id=target_id,
                alarm_type='SPEC',
                severity='CRITICAL',
                description=f'평균값 USL 초과 ({measurement.avg_value} > {spec.usl})',
                value=measurement.avg_value,
                spec=spec,
            ))
        elif measurement.avg_value < spec.lsl:
            alarms.append(_create_alarm(
                measurement_id=measurement.id,
                target_id=target_id,
                alarm_type='SPEC',
                severity='CRITICAL',
                description=f'평균값 LSL 미달 ({measurement.avg_value} < {spec.lsl})',
                value=measurement.avg_value,
                spec=spec,
            ))

    return alarms


def _check_r_chart(
    db: Session,
    measurement: models.Measurement,
    target_id: int
) -> List[models.SpcAlarm]:
    """R차트 관리한계(R_UCL) 초과 판정"""
    alarms = []
    constants = CONTROL_CHART_CONSTANTS[SUBGROUP_SIZE]

    # 최근 측정값의 range_value로 R_bar 계산
    recent = _get_recent_measurements(db, target_id, count=25)
    if len(recent) < 2:
        return alarms

    range_values = [m.range_value for m in recent if m.range_value is not None]
    if not range_values:
        return alarms

    r_bar = sum(range_values) / len(range_values)
    r_ucl = r_bar * constants["D4"]
    # D3 = 0 for subgroup size 5, so R_LCL = 0

    if measurement.range_value is not None and measurement.range_value > r_ucl:
        alarms.append(_create_alarm(
            measurement_id=measurement.id,
            target_id=target_id,
            alarm_type='R_CHART',
            severity='CRITICAL',
            description=f'R차트 UCL 초과 (R={measurement.range_value}, R_UCL={round(r_ucl, 3)})',
            value=measurement.range_value,
            cl_snapshot=round(r_bar, 3),
            ucl_snapshot=round(r_ucl, 3),
            lcl_snapshot=0,
        ))

    return alarms


def _check_nelson_rules(
    db: Session,
    measurement: models.Measurement,
    target_id: int,
    active_spec: Optional[models.Spec]
) -> List[models.SpcAlarm]:
    """Nelson Rule 1, 2, 3 판정 (기존 spc.py의 detect_nelson_rules 재사용)"""
    alarms = []

    # Nelson Rule 2의 윈도우가 9이므로 최근 9건 필요
    recent = _get_recent_measurements(db, target_id, count=9)
    if not recent:
        return alarms

    values = [m.avg_value for m in recent]
    lot_nos = [m.lot_no for m in recent]

    # 관리한계 설정: Spec의 UCL/LCL 우선, 없으면 데이터 기반 계산
    if active_spec and active_spec.ucl and active_spec.lcl:
        import numpy as np
        cl = round(float(np.mean(values)), 3)
        ucl = active_spec.ucl
        lcl = active_spec.lcl
    else:
        limits = calculate_control_limits(values)
        cl = limits["cl"]
        ucl = limits["ucl"]
        lcl = limits["lcl"]

    if cl is None or ucl is None or lcl is None:
        return alarms

    # recent는 DESC로 조회되므로 detect_nelson_rules에 넘기기 위해 ASC로 뒤집음
    values_asc = list(reversed(values))
    lot_nos_asc = list(reversed(lot_nos))
    current_index_asc = len(values_asc) - 1  # 최신 측정의 ASC 인덱스

    all_patterns = detect_nelson_rules(values_asc, cl, ucl, lcl, lot_nos_asc)

    # 현재 measurement에서 "새로 완성된" 위반만 알람 생성
    # (Rule 1: 현재 점이 3σ 이탈, Rule 2/3: 현재 점에서 패턴이 종료)
    for pattern in all_patterns:
        rule = pattern.get("rule")
        if rule not in (1, 2, 3):
            continue

        pos = pattern.get("position", 0)
        length = pattern.get("length", 1)
        pattern_end = pos + length - 1

        if pattern_end != current_index_asc:
            continue

        if rule == 1:
            severity = 'CRITICAL'
            alarm_type = 'NELSON'
        else:
            severity = 'WARNING'
            alarm_type = 'NELSON'

        description_map = {
            1: f'Nelson Rule 1: 3σ 이탈 (값={measurement.avg_value}, UCL={ucl}, LCL={lcl})',
            2: f'Nelson Rule 2: 9점 연속 중심선 한쪽 (CL={cl})',
            3: f'Nelson Rule 3: 6점 연속 증가/감소 추세',
        }

        alarms.append(_create_alarm(
            measurement_id=measurement.id,
            target_id=target_id,
            alarm_type=alarm_type,
            severity=severity,
            rule_number=rule,
            description=description_map[rule],
            value=measurement.avg_value,
            cl_snapshot=cl,
            ucl_snapshot=ucl,
            lcl_snapshot=lcl,
        ))

    return alarms


def _get_recent_measurements(
    db: Session,
    target_id: int,
    count: int = 9
) -> List[models.Measurement]:
    """최근 N건 측정값 조회 (target_id + created_at 인덱스 활용)"""
    return db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id
    ).order_by(
        models.Measurement.created_at.desc()
    ).limit(count).all()


def _create_alarm(
    measurement_id: int,
    target_id: int,
    alarm_type: str,
    severity: str,
    description: str,
    value: float,
    cl_snapshot: float = None,
    ucl_snapshot: float = None,
    lcl_snapshot: float = None,
    spec: models.Spec = None,
    rule_number: int = None,
) -> models.SpcAlarm:
    """SpcAlarm 레코드 생성 헬퍼"""
    return models.SpcAlarm(
        measurement_id=measurement_id,
        target_id=target_id,
        alarm_type=alarm_type,
        severity=severity,
        rule_number=rule_number,
        description=description,
        value=value,
        cl_snapshot=cl_snapshot,
        ucl_snapshot=ucl_snapshot,
        lcl_snapshot=lcl_snapshot,
        spec_usl=spec.usl if spec else None,
        spec_lsl=spec.lsl if spec else None,
        status='ACTIVE',
    )


def reevaluate_after_edit(db: Session, measurement_id: int) -> None:
    """
    측정 수정 후 재판정.
    수정된 measurement 기준 앞뒤 8건(Nelson Rule 2 윈도우)에 속하는
    모든 measurement에 대해 기존 알람을 SUPERSEDED 처리하고 재판정한다.
    """
    measurement = db.query(models.Measurement).filter(
        models.Measurement.id == measurement_id
    ).first()

    if not measurement:
        return

    target_id = measurement.target_id
    created_at = measurement.created_at

    # 수정된 측정 기준 앞뒤 8건 조회 (Nelson Rule 2 윈도우 = 9)
    before = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at < created_at
    ).order_by(models.Measurement.created_at.desc()).limit(8).all()

    after = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at > created_at
    ).order_by(models.Measurement.created_at.asc()).limit(8).all()

    affected_ids = [m.id for m in before] + [measurement_id] + [m.id for m in after]

    # 기존 ACTIVE 알람을 SUPERSEDED로 변경
    db.query(models.SpcAlarm).filter(
        models.SpcAlarm.measurement_id.in_(affected_ids),
        models.SpcAlarm.status == 'ACTIVE'
    ).update({models.SpcAlarm.status: 'SUPERSEDED'}, synchronize_session='fetch')

    db.commit()

    # 영향받는 모든 measurement에 대해 재판정
    for mid in affected_ids:
        evaluate_measurement_alarms(db, mid)


def save_change_history(
    db: Session,
    measurement: models.Measurement,
    after_values: dict,
    changed_by: str,
    reason: str = None,
    change_type: str = 'UPDATE'
) -> models.MeasurementChangeHistory:
    """측정 수정 이력 저장"""
    before_values = {
        "value_top": measurement.value_top,
        "value_center": measurement.value_center,
        "value_bottom": measurement.value_bottom,
        "value_left": measurement.value_left,
        "value_right": measurement.value_right,
        "avg_value": measurement.avg_value,
        "range_value": measurement.range_value,
        "std_dev": measurement.std_dev,
    }

    history = models.MeasurementChangeHistory(
        measurement_id=measurement.id,
        change_type=change_type,
        before_values=json.dumps(before_values),
        after_values=json.dumps(after_values) if after_values else None,
        changed_by=changed_by,
        reason=reason,
    )

    db.add(history)
    return history
