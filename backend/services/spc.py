from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy.orm import Session
from ..database import models
from . import statistics as stats_service

def calculate_control_limits(values: List[float], sigma_level: int = 3) -> Dict[str, float]:
    """
    관리 한계선(CL, UCL, LCL) 계산
    """
    if not values or len(values) < 2:
        return {
            "cl": None,
            "ucl": None,
            "lcl": None
        }
    
    # 중심선 (CL)
    cl = np.mean(values)
    
    # 표준편차
    std_dev = np.std(values, ddof=1)  # ddof=1 for sample standard deviation
    
    # 관리 한계선
    ucl = cl + (sigma_level * std_dev)
    lcl = cl - (sigma_level * std_dev)
    
    return {
        "cl": round(cl, 3),
        "ucl": round(ucl, 3),
        "lcl": round(lcl, 3)
    }

# detect_nelson_rules 함수 내에서 패턴 객체를 생성하는 부분 수정
# "position" 대신 실제 측정 데이터의 LOT NO를 포함하도록 수정

def detect_nelson_rules(values: List[float], cl: float, ucl: float, lcl: float, lot_nos: List[str]) -> List[Dict[str, Any]]:
    """
    Nelson Rules에 기반한 패턴 감지
    """
    if not values:  # 데이터가 비어있는 경우만 체크
        return []
    
    # 표준편차 계산 (UCL-CL)/3 (3-시그마 기준)
    std_dev = (ucl - cl) / 3
    
    # 1 시그마, 2 시그마 구간 계산
    zone_a_upper = cl + (2 * std_dev)
    zone_a_lower = cl - (2 * std_dev)
    zone_b_upper = cl + std_dev
    zone_b_lower = cl - std_dev
    
    # 결과 저장 리스트
    patterns = []
    
    # Rule 1: 한 점이 관리 한계선을 벗어남 - 항상 검사
    for i, value in enumerate(values):
        if value > ucl or value < lcl:
            patterns.append({
                "rule": 1,
                "description": "한 점이 관리 한계선을 벗어남",
                "position": i,
                "lot_no": lot_nos[i] if i < len(lot_nos) else f"포인트 {i+1}",
                "value": value
            })
    
    # 데이터가 충분하지 않으면 나머지 규칙은 건너뜀
    if len(values) < 9:
        return patterns
    
    # Rule 2: 9개 연속 점이 중심선의 같은 쪽에 있음
    for i in range(len(values) - 8):
        if all(v > cl for v in values[i:i+9]) or all(v < cl for v in values[i:i+9]):
            patterns.append({
                "rule": 2,
                "description": "9개 연속 점이 중심선의 같은 쪽에 있음",
                "position": i,
                "length": 9
            })
    
    # Rule 3: 6개 연속 점이 증가하거나 감소함
    for i in range(len(values) - 5):
        if all(values[i+j] < values[i+j+1] for j in range(5)) or all(values[i+j] > values[i+j+1] for j in range(5)):
            patterns.append({
                "rule": 3,
                "description": "6개 연속 점이 증가하거나 감소함",
                "position": i,
                "length": 6
            })
    
    # Rule 4: 14개 연속 점이 교대로 증가/감소함
    for i in range(len(values) - 13):
        ups_and_downs = [1 if values[i+j] < values[i+j+1] else -1 for j in range(13)]
        alternating = True
        for j in range(len(ups_and_downs) - 1):
            if ups_and_downs[j] == ups_and_downs[j+1]:
                alternating = False
                break
        if alternating:
            patterns.append({
                "rule": 4,
                "description": "14개 연속 점이 교대로 증가/감소함",
                "position": i,
                "length": 14
            })
    
    # Rule 5: 2점 중 2점이 3-시그마 구간의 같은 쪽에 있음 (Zone A)
    for i in range(len(values) - 1):
        if (values[i] > zone_a_upper and values[i+1] > zone_a_upper) or (values[i] < zone_a_lower and values[i+1] < zone_a_lower):
            patterns.append({
                "rule": 5,
                "description": "2점 중 2점이 3-시그마 구간의 같은 쪽에 있음 (Zone A)",
                "position": i,
                "length": 2
            })
    
    # Rule 6: 4점 중 4점이 2-시그마 구간의 같은 쪽에 있음 (Zone B)
    for i in range(len(values) - 3):
        if all(v > zone_b_upper for v in values[i:i+4]) or all(v < zone_b_lower for v in values[i:i+4]):
            patterns.append({
                "rule": 6,
                "description": "4점 중 4점이 2-시그마 구간의 같은 쪽에 있음 (Zone B)",
                "position": i,
                "length": 4
            })
    
    # Rule 7: 15개 연속 점이 1-시그마 구간 안에 있음 (Zone C)
    for i in range(len(values) - 14):
        if all(zone_b_lower < v < zone_b_upper for v in values[i:i+15]):
            patterns.append({
                "rule": 7,
                "description": "15개 연속 점이 1-시그마 구간 안에 있음 (Zone C)",
                "position": i,
                "length": 15
            })
    
    # Rule 8: 8개 연속 점이 1-시그마 구간 바깥에 있음
    for i in range(len(values) - 7):
        if all((v < zone_b_lower or v > zone_b_upper) for v in values[i:i+8]):
            patterns.append({
                "rule": 8,
                "description": "8개 연속 점이 1-시그마 구간 바깥에 있음",
                "position": i,
                "length": 8
            })
    
    return patterns

# analyze_spc 함수 수정
def analyze_spc(db: Session, target_id: int, days: int = 30, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict[str, Any]:
    """
    특정 타겟에 대한 SPC 분석 수행
    """
    # 시작 날짜와 종료 날짜 설정
    if not start_date:
        start_date = datetime.now() - timedelta(days=days)
    
    if not end_date:
        end_date = datetime.now()
    
    # 측정 데이터 쿼리
    query = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at >= start_date
    )

    # 종료 날짜가 지정된 경우 추가 필터링
    if end_date:
        query = query.filter(models.Measurement.created_at <= end_date)

    query = query.order_by(models.Measurement.created_at.asc())
    
    measurements = query.all()
    
    if not measurements:
        return {
            "target_id": target_id,
            "sample_count": 0,
            "message": "No data found for the specified period"
        }
    
    # 평균값 추출
    values = [m.avg_value for m in measurements]
    dates = [m.created_at for m in measurements]
    lot_nos = [m.lot_no for m in measurements]  # LOT NO 추출
    
    # 관리 한계선 계산
    control_limits = calculate_control_limits(values)
    
    # 패턴 감지와 LOT NO 연결
    patterns = []
    if control_limits["cl"] is not None:
        patterns = detect_nelson_rules(values, control_limits["cl"], control_limits["ucl"], control_limits["lcl"], lot_nos)
        
        # 패턴에 LOT NO 정보 추가
        for pattern in patterns:
            pos = pattern.get("position", 0)
            if 0 <= pos < len(lot_nos):
                pattern["lot_no"] = lot_nos[pos]

    # 위치별 데이터도 분석
    position_values = {
        "top": [m.value_top for m in measurements],
        "center": [m.value_center for m in measurements],
        "bottom": [m.value_bottom for m in measurements],
        "left": [m.value_left for m in measurements],
        "right": [m.value_right for m in measurements]
    }
    
    position_control_limits = {}
    position_patterns = {}
    
    for position, pos_values in position_values.items():
        pos_cl = calculate_control_limits(pos_values)
        position_control_limits[position] = pos_cl
        
        if pos_cl["cl"] is not None:
            pos_patterns = detect_nelson_rules(
                pos_values,
                pos_cl["cl"],
                pos_cl["ucl"],
                pos_cl["lcl"],
                lot_nos
            )
            position_patterns[position] = pos_patterns
            
    
    # SPEC 가져오기
    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()
    
    # 결과 딕셔너리 초기화
    result = {
        "target_id": target_id,
        "sample_count": len(measurements),
        "data": {
            "values": values,
            "dates": [d.isoformat() for d in dates],
            "lot_nos": lot_nos
        },
        "control_limits": control_limits,
        "patterns": patterns,
        "position_data": {
            position: pos_values for position, pos_values in position_values.items()
        },
        "position_control_limits": position_control_limits,
        "position_patterns": position_patterns
    }
    
    # SPEC 및 공정 능력 지수 추가
    if active_spec:
        result["spec"] = {
            "lsl": active_spec.lsl,
            "usl": active_spec.usl,
            "target": (active_spec.usl + active_spec.lsl) / 2  # 타겟 추가
        }
        
        # 공정 능력 지수 계산 및 추가
        result["process_capability"] = stats_service.calculate_process_capability(
            values, active_spec.lsl, active_spec.usl
        )
    
    return result
