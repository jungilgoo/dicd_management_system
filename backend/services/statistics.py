import statistics
import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..database import models

def calculate_basic_statistics(values: List[float]) -> Dict[str, float]:
    """
    기본 통계값 계산 (평균, 표준편차, 최소값, 최대값, 범위)
    """
    if not values:
        return {
            "avg": None,
            "std_dev": None,
            "min": None,
            "max": None,
            "range": None
        }
    
    avg = statistics.mean(values)
    std_dev = statistics.stdev(values) if len(values) > 1 else 0
    min_val = min(values)
    max_val = max(values)
    range_val = max_val - min_val
    
    return {
        "avg": round(avg, 3),
        "std_dev": round(std_dev, 3),
        "min": round(min_val, 3),
        "max": round(max_val, 3),
        "range": round(range_val, 3)
    }

def calculate_process_capability(values: List[float], lsl: float, usl: float) -> Dict[str, float]:
    """
    공정능력지수 계산 (Cp, Cpk, Pp, Ppk)
    """
    if not values or len(values) < 2:
        return {
            "cp": None,
            "cpk": None,
            "pp": None,
            "ppk": None
        }
    
    # 기본 통계값 계산
    avg = statistics.mean(values)
    
    # 규격 폭
    spec_width = usl - lsl
    
    # 장기(overall) 표준편차 - 전체 데이터에서 계산
    overall_std_dev = statistics.stdev(values)
    
    # 단기 표준편차 계산 - 이상적으로는 subgroup을 사용해야 하지만
    # 여기서는 이동 범위(moving range)로 추정
    if len(values) > 1:
        moving_ranges = [abs(values[i] - values[i-1]) for i in range(1, len(values))]
        mr_bar = sum(moving_ranges) / len(moving_ranges)
        # d2는 이동 범위에 대한 통계적 상수 (샘플 크기 2의 경우 1.128)
        d2 = 1.128
        short_term_std_dev = mr_bar / d2
    else:
        # 데이터가 충분하지 않은 경우 장기 표준편차 사용
        short_term_std_dev = overall_std_dev
    
    # Cp: 단기 공정능력지수 (단기 표준편차 사용)
    cp = spec_width / (6 * short_term_std_dev) if short_term_std_dev > 0 else float('inf')
    
    # Cpk: 단기 공정능력지수 (편중 고려)
    cpu = (usl - avg) / (3 * short_term_std_dev) if short_term_std_dev > 0 else float('inf')
    cpl = (avg - lsl) / (3 * short_term_std_dev) if short_term_std_dev > 0 else float('inf')
    cpk = min(cpu, cpl)
    
    # Pp: 장기 공정능력지수 (장기 표준편차 사용)
    pp = spec_width / (6 * overall_std_dev) if overall_std_dev > 0 else float('inf')
    
    # Ppk: 장기 공정능력지수 (편중 고려)
    ppu = (usl - avg) / (3 * overall_std_dev) if overall_std_dev > 0 else float('inf')
    ppl = (avg - lsl) / (3 * overall_std_dev) if overall_std_dev > 0 else float('inf')
    ppk = min(ppu, ppl)
    
    return {
        "cp": round(cp, 3),
        "cpk": round(cpk, 3),
        "pp": round(pp, 3),
        "ppk": round(ppk, 3),
        "cpu": round(cpu, 3),
        "cpl": round(cpl, 3)
    }

def get_process_statistics(db: Session, target_id: int, start_date=None, end_date=None) -> Dict[str, Any]:
    """
    특정 타겟에 대한 공정 통계 계산
    """
    # 쿼리 설정
    query = db.query(models.Measurement).filter(models.Measurement.target_id == target_id)
    
    if start_date:
        query = query.filter(models.Measurement.created_at >= start_date)
    if end_date:
        query = query.filter(models.Measurement.created_at <= end_date)
    
    measurements = query.all()
    
    # 측정값 추출
    all_values = []
    position_values = {
        "top": [],
        "center": [],
        "bottom": [],
        "left": [],
        "right": []
    }
    
    for m in measurements:
        all_values.append(m.avg_value)
        position_values["top"].append(m.value_top)
        position_values["center"].append(m.value_center)
        position_values["bottom"].append(m.value_bottom)
        position_values["left"].append(m.value_left)
        position_values["right"].append(m.value_right)
    
    # 활성 SPEC 가져오기
    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()
    
    lsl = active_spec.lsl if active_spec else None
    usl = active_spec.usl if active_spec else None
    
    # 결과 생성
    result = {
        "target_id": target_id,
        "sample_count": len(measurements),
        "overall_statistics": calculate_basic_statistics(all_values)
    }
    
    # 위치별 통계
    result["position_statistics"] = {}
    for position, values in position_values.items():
        result["position_statistics"][position] = calculate_basic_statistics(values)
    
    # 공정능력지수
    if lsl is not None and usl is not None:
        result["spec"] = {
            "lsl": lsl,
            "usl": usl,
            "target": (lsl + usl) / 2
        }
        result["process_capability"] = calculate_process_capability(all_values, lsl, usl)
        
        # 위치별 공정능력
        result["position_capability"] = {}
        for position, values in position_values.items():
            result["position_capability"][position] = calculate_process_capability(values, lsl, usl)
    
    return result

def get_boxplot_data(db: Session, target_id: int, group_by: str, start_date=None, end_date=None) -> Dict[str, Any]:
    """
    박스플롯 분석을 위한 데이터 계산
    group_by: 'equipment' 또는 'device'
    """
    # 쿼리 설정
    query = db.query(models.Measurement).filter(models.Measurement.target_id == target_id)
    
    if start_date:
        query = query.filter(models.Measurement.created_at >= start_date)
    
    if end_date:
        query = query.filter(models.Measurement.created_at <= end_date)
    
    measurements = query.all()
    
    if not measurements:
        return {"target_id": target_id, "groups": []}
    
    # 그룹화 기준에 따라 데이터 정리
    groups = {}
    
    if group_by == 'equipment':
        # 장비 ID별로 그룹화
        for m in measurements:
            # 각 장비 유형별로 처리
            if m.coating_equipment_id:
                equipment = db.query(models.Equipment).filter(models.Equipment.id == m.coating_equipment_id).first()
                if equipment:
                    key = f"코팅: {equipment.name}"
                    if key not in groups:
                        groups[key] = []
                    groups[key].append(m.avg_value)
            
            if m.exposure_equipment_id:
                equipment = db.query(models.Equipment).filter(models.Equipment.id == m.exposure_equipment_id).first()
                if equipment:
                    key = f"노광: {equipment.name}"
                    if key not in groups:
                        groups[key] = []
                    groups[key].append(m.avg_value)
            
            if m.development_equipment_id:
                equipment = db.query(models.Equipment).filter(models.Equipment.id == m.development_equipment_id).first()
                if equipment:
                    key = f"현상: {equipment.name}"
                    if key not in groups:
                        groups[key] = []
                    groups[key].append(m.avg_value)
    
    elif group_by == 'device':
        # 디바이스별로 그룹화
        for m in measurements:
            if m.device not in groups:
                groups[m.device] = []
            groups[m.device].append(m.avg_value)
    
    # 결과 데이터 구성
    result_groups = []
    
    for name, values in groups.items():
        if len(values) < 5:  # 데이터가 너무 적으면 통계적으로 의미가 없음
            continue
            
        # 통계값 계산
        sorted_values = sorted(values)
        q1_idx = int(len(sorted_values) * 0.25)
        q3_idx = int(len(sorted_values) * 0.75)
        
        min_val = min(sorted_values)
        max_val = max(sorted_values)
        q1 = sorted_values[q1_idx]
        q3 = sorted_values[q3_idx]
        median = statistics.median(sorted_values)
        
        # 이상치 계산 (IQR 방식)
        iqr = q3 - q1
        lower_bound = q1 - (1.5 * iqr)
        upper_bound = q3 + (1.5 * iqr)
        
        outliers = [v for v in values if v < lower_bound or v > upper_bound]
        
        # 위스커 계산 (이상치를 제외한 최소/최대값)
        whisker_min = min([v for v in sorted_values if v >= lower_bound])
        whisker_max = max([v for v in sorted_values if v <= upper_bound])
        
        result_groups.append({
            "name": name,
            "count": len(values),
            "min": round(min_val, 3),
            "max": round(max_val, 3),
            "median": round(median, 3),
            "q1": round(q1, 3),
            "q3": round(q3, 3),
            "whisker_min": round(whisker_min, 3),
            "whisker_max": round(whisker_max, 3),
            "outliers": [round(o, 3) for o in outliers]
        })
    
    # 타겟 정보 조회
    target = db.query(models.Target).filter(models.Target.id == target_id).first()
    
    # 활성 SPEC 가져오기
    spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()
    
    result = {
        "target_id": target_id,
        "target_name": target.name if target else None,
        "groups": sorted(result_groups, key=lambda x: x["name"])
    }
    
    # SPEC 정보 추가
    if spec:
        result["spec"] = {
            "lsl": spec.lsl,
            "usl": spec.usl
        }
    
    return result