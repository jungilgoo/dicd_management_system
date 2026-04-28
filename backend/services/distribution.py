from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy.orm import Session
from ..database import models
from .spec_segments import build_spec_segments
import math

# 위치별 편차 분석에서 사용하는 5-point 위치 설정
_SITE_CONFIG = [
    {"site": "T", "site_name": "상(Top)",    "column": "value_top"},
    {"site": "C", "site_name": "중(Center)", "column": "value_center"},
    {"site": "B", "site_name": "하(Bottom)", "column": "value_bottom"},
    {"site": "L", "site_name": "좌(Left)",   "column": "value_left"},
    {"site": "R", "site_name": "우(Right)",  "column": "value_right"},
]

def _convert_numpy_types(obj):
    """NumPy 타입을 Python 내장 타입으로 변환"""
    if isinstance(obj, dict):
        return {k: _convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types(i) for i in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return _convert_numpy_types(obj.tolist())
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj

def _calculate_cpk(values: List[float], lsl: Optional[float], usl: Optional[float]) -> Optional[float]:
    if not values or lsl is None or usl is None:
        return None
    mean = np.mean(values)
    std = np.std(values, ddof=1)
    if std == 0:
        return None
    return float(min((usl - mean) / (3 * std), (mean - lsl) / (3 * std)))

def _build_measurement_query(
    db: Session,
    target_id: int,
    days: int,
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None,
    etch_equipment_id: Optional[int] = None,
):
    if not start_date:
        start_date = datetime.now() - timedelta(days=days)

    query = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at >= start_date,
    )
    if end_date:
        query = query.filter(models.Measurement.created_at <= end_date)
    if coating_equipment_id:
        query = query.filter(models.Measurement.coating_equipment_id == coating_equipment_id)
    if exposure_equipment_id:
        query = query.filter(models.Measurement.exposure_equipment_id == exposure_equipment_id)
    if development_equipment_id:
        query = query.filter(models.Measurement.development_equipment_id == development_equipment_id)
    if etch_equipment_id:
        query = query.filter(models.Measurement.etch_equipment_id == etch_equipment_id)

    return query.order_by(models.Measurement.created_at.asc())

def calculate_histogram(values: List[float], bins: int = None) -> Dict[str, Any]:
    """
    히스토그램 데이터 계산 (최적의 bin 크기 사용)
    """
    if not values or len(values) < 2:
        return {
            "bins": [],
            "counts": [],
            "bin_edges": []
        }
    
    # 데이터 수에 따른 최적의 bin 개수 계산 (스콧의 규칙)
    if bins is None:
        n = len(values)
        std_dev = np.std(values, ddof=1)
        # 스콧의 규칙: h = 3.5 * σ * n^(-1/3)
        bin_width = 3.5 * std_dev * (n ** (-1/3))
        data_range = max(values) - min(values)
        bins = max(5, min(50, int(np.ceil(data_range / bin_width))))
    
    # 히스토그램 계산
    counts, bin_edges = np.histogram(values, bins=bins)
    
    # 결과 가공
    result = {
        "bins": [(bin_edges[i] + bin_edges[i+1])/2 for i in range(len(bin_edges)-1)],
        "counts": counts.tolist(),
        "bin_edges": bin_edges.tolist()
    }
    
    return result

def calculate_normal_pdf(values: List[float], bins: int = 200) -> Dict[str, Any]:
    """
    정규분포 확률밀도함수(PDF) 계산 (더 부드러운 곡선용 포인트 증가)
    """
    if not values or len(values) < 2:
        return {
            "x": [],
            "y": []
        }
    
    # 평균과 표준편차 계산
    mean = np.mean(values)
    std_dev = np.std(values, ddof=1)
    
    # 표시 범위 계산 (평균 ± 4 시그마)
    min_x = mean - 4 * std_dev
    max_x = mean + 4 * std_dev
    
    # x 값 생성 (지정된 bins 수만큼)
    x = np.linspace(min_x, max_x, bins)
    
    # 정규분포 PDF 계산
    y = (1 / (std_dev * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x - mean) / std_dev) ** 2)
    
    # 결과 가공
    result = {
        "x": x.tolist(),
        "y": y.tolist(),
        "mean": float(mean),
        "std_dev": float(std_dev)
    }
    
    return result

def calculate_distribution_statistics(values: List[float]) -> Dict[str, Any]:
    """
    분포 관련 통계값 계산 (왜도, 첨도 등)
    """
    if not values or len(values) < 3:  # 왜도는 최소 3개 이상의 데이터 필요
        return {
            "mean": None,
            "median": None,
            "std_dev": None,
            "skewness": None,
            "kurtosis": None,
            "normality_test": None
        }
    
    # 기본 통계값 계산
    mean = np.mean(values)
    median = np.median(values)
    std_dev = np.std(values, ddof=1)
    
    # 왜도 계산 (Skewness)
    n = len(values)
    m3 = sum([(x - mean) ** 3 for x in values]) / n
    skewness = m3 / (std_dev ** 3)
    
    # 첨도 계산 (Kurtosis)
    m4 = sum([(x - mean) ** 4 for x in values]) / n
    kurtosis = m4 / (std_dev ** 4) - 3  # 정규분포의 첨도가 0이 되도록 조정 (Excess Kurtosis)
    
    # D'Agostino-Pearson 정규성 검정 간소화 버전
    # 왜도와 첨도를 기반으로 근사값 계산
    k2 = n * (skewness**2 / 6 + kurtosis**2 / 24)
    p_value = np.exp(-0.5 * k2) if k2 < 100 else 0  # 간단한 근사 계산
    # calculate_distribution_statistics 함수 내에서
    normality = {
        "test": "D'Agostino-Pearson (approximation)",
        "statistic": float(k2),  # NumPy 값을 Python float로 변환
        "p_value": float(p_value),  # NumPy 값을 Python float로 변환
        "is_normal": bool(p_value > 0.05)  # NumPy bool을 Python bool로 변환
    }
    
    return {
        "mean": round(mean, 3),
        "median": round(median, 3),
        "std_dev": round(std_dev, 3),
        "skewness": round(skewness, 3),
        "kurtosis": round(kurtosis, 3),
        "normality_test": normality
    }

# 변경 후
def get_distribution_analysis(
    db: Session, 
    target_id: int, 
    days: int = 30, 
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    특정 타겟에 대한 분포 분석 수행
    """

    # 시작 날짜와 종료 날짜 설정
    if not start_date:
        start_date = datetime.now() - timedelta(days=days)

    
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
    
    # 위치별 값 추출
    position_values = {
        "top": [m.value_top for m in measurements],
        "center": [m.value_center for m in measurements],
        "bottom": [m.value_bottom for m in measurements],
        "left": [m.value_left for m in measurements],
        "right": [m.value_right for m in measurements]
    }
    
    # 히스토그램 계산
    # 빈(bin) 개수는 데이터 수의 제곱근을 반올림하여 결정 (스터지스 공식 변형)
    bins = max(5, min(20, round(math.sqrt(len(values)))))
    histogram = calculate_histogram(values, bins=bins)
    
    # 정규분포 PDF 계산
    normal_pdf = calculate_normal_pdf(values)
    
    # 분포 통계값 계산
    distribution_stats = calculate_distribution_statistics(values)
    
    # 위치별 분포 분석
    position_analysis = {}
    for position, pos_values in position_values.items():
        position_analysis[position] = {
            "histogram": calculate_histogram(pos_values, bins=bins),
            "normal_pdf": calculate_normal_pdf(pos_values),
            "stats": calculate_distribution_statistics(pos_values)
        }
    
    # SPEC 정보 가져오기
    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()
    
    spec_info = None
    if active_spec:
        # SPEC 기준 규격값 내 비율 계산
        in_spec_ratio = sum(1 for v in values if active_spec.lsl <= v <= active_spec.usl) / len(values)
        
        spec_info = {
            "lsl": active_spec.lsl,
            "usl": active_spec.usl,
            "target": (active_spec.lsl + active_spec.usl) / 2,
            "in_spec_ratio": round(in_spec_ratio, 4),
            "in_spec_percent": round(in_spec_ratio * 100, 2)
        }
    # NumPy 값을 Python 내장 타입으로 변환하는 함수
    def convert_numpy_types(obj):
        if isinstance(obj, dict):
            return {key: convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [convert_numpy_types(item) for item in obj]
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return convert_numpy_types(obj.tolist())
        elif isinstance(obj, np.bool_):
            return bool(obj)
        else:
            return obj

    # 결과를 반환하기 전에 변환 적용
    result = {
        "target_id": target_id,
        "sample_count": len(measurements),
        "values": values,
        "histogram": histogram,
        "normal_pdf": normal_pdf,
        "distribution_stats": distribution_stats,
        "position_analysis": position_analysis
    }

    if spec_info:
        result["spec"] = spec_info

    # SPEC 구간 정보 추가 (다중 SPEC 수직선 표시용)
    result["spec_segments"] = build_spec_segments(measurements, db)

    # NumPy 타입을 Python 내장 타입으로 변환
    result = convert_numpy_types(result)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 위치별 편차 분석 함수
# ─────────────────────────────────────────────────────────────────────────────

def detect_spatial_pattern(
    ce_diff: float,
    lr_asym: float,
    tb_asym: float,
    thresholds: Dict[str, float],
) -> List[Dict[str, str]]:
    """공간 패턴 자동 판정 (명세서 3.3)"""
    patterns = []

    if ce_diff > thresholds.get("ce_diff_ucl", float("inf")):
        patterns.append({"type": "CENTER_HIGH", "description": "Center 측정값이 Edge 대비 유의하게 높음"})
    elif ce_diff < thresholds.get("ce_diff_lcl", float("-inf")):
        patterns.append({"type": "CENTER_LOW", "description": "Center 측정값이 Edge 대비 유의하게 낮음"})

    if abs(lr_asym) > thresholds.get("lr_asym_3sigma", float("inf")):
        direction = "Left > Right" if lr_asym > 0 else "Right > Left"
        patterns.append({"type": "LR_ASYMMETRY", "description": f"좌우 비대칭 발생 ({direction})"})

    if abs(tb_asym) > thresholds.get("tb_asym_3sigma", float("inf")):
        direction = "Top > Bottom" if tb_asym > 0 else "Bottom > Top"
        patterns.append({"type": "TB_ASYMMETRY", "description": f"상하 비대칭 발생 ({direction})"})

    return patterns if patterns else [{"type": "NORMAL", "description": "정상 범위"}]


def get_site_analysis(
    db: Session,
    target_id: int,
    days: int = 30,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None,
    etch_equipment_id: Optional[int] = None,
) -> Dict[str, Any]:
    """위치별 편차 분석 통계 반환 (명세서 3.1)"""

    measurements = _build_measurement_query(
        db, target_id, days, start_date, end_date,
        coating_equipment_id, exposure_equipment_id,
        development_equipment_id, etch_equipment_id,
    ).all()

    if not measurements:
        return {
            "target_id": target_id,
            "summary": {"total_wafers": 0, "message": "데이터 없음"},
            "site_statistics": [],
            "range_statistics": None,
            "pattern_analysis": None,
        }

    active_spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True,
    ).first()
    lsl = active_spec.lsl if active_spec else None
    usl = active_spec.usl if active_spec else None

    all_avgs = [m.avg_value for m in measurements]
    summary = {
        "total_wafers": len(measurements),
        "date_range": {
            "start": min(m.created_at for m in measurements).strftime("%Y-%m-%d"),
            "end":   max(m.created_at for m in measurements).strftime("%Y-%m-%d"),
        },
        "overall_mean": round(float(np.mean(all_avgs)), 4),
        "overall_std":  round(float(np.std(all_avgs, ddof=1)) if len(all_avgs) > 1 else 0.0, 4),
    }

    insufficient = len(measurements) < 30

    site_statistics = []
    for cfg in _SITE_CONFIG:
        col = cfg["column"]
        vals = [v for v in (getattr(m, col) for m in measurements) if v is not None]
        devs = [getattr(m, col) - m.avg_value for m in measurements
                if getattr(m, col) is not None and m.avg_value is not None]

        mean_v   = float(np.mean(vals))
        std_v    = float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0
        dev_mean = float(np.mean(devs))
        dev_std  = float(np.std(devs, ddof=1)) if len(devs) > 1 else 0.0

        if insufficient:
            ucl = lcl = None
        else:
            ucl = round(dev_mean + 3 * dev_std, 4)
            lcl = round(dev_mean - 3 * dev_std, 4)

        site_statistics.append({
            "site":           cfg["site"],
            "site_name":      cfg["site_name"],
            "column_name":    col,
            "count":          len(vals),
            "mean":           round(mean_v, 4),
            "std":            round(std_v, 4),
            "min":            round(float(min(vals)), 4),
            "max":            round(float(max(vals)), 4),
            "median":         round(float(np.median(vals)), 4),
            "deviation_mean": round(dev_mean, 4),
            "deviation_std":  round(dev_std, 4),
            "cpk":            _calculate_cpk(vals, lsl, usl),
            "deviation_ucl":  ucl,
            "deviation_lcl":  lcl,
        })

    range_vals = [m.range_value for m in measurements if m.range_value is not None]
    range_mean = float(np.mean(range_vals)) if range_vals else 0.0
    range_std  = float(np.std(range_vals, ddof=1)) if len(range_vals) > 1 else 0.0
    range_ucl  = None if insufficient else round(range_mean + 3 * range_std, 4)
    range_exceed_count = sum(1 for v in range_vals if range_ucl is not None and v > range_ucl)
    range_statistics = {
        "mean":          round(range_mean, 4),
        "std":           round(range_std, 4),
        "ucl":           range_ucl,
        "max_observed":  round(float(max(range_vals)), 4) if range_vals else None,
        "total_count":   len(range_vals),
        "exceed_count":  range_exceed_count,
        "exceed_rate":   round(range_exceed_count / len(range_vals) * 100, 1) if range_vals else 0.0,
    }

    ce_diffs = [
        m.value_center - float(np.mean([m.value_top, m.value_bottom, m.value_left, m.value_right]))
        for m in measurements
        if None not in (m.value_center, m.value_top, m.value_bottom, m.value_left, m.value_right)
    ]
    lr_asyms = [m.value_left - m.value_right for m in measurements
                if m.value_left is not None and m.value_right is not None]
    tb_asyms = [m.value_top  - m.value_bottom for m in measurements
                if m.value_top  is not None and m.value_bottom is not None]

    ce_mean = float(np.mean(ce_diffs)); ce_std = float(np.std(ce_diffs, ddof=1)) if len(ce_diffs) > 1 else 0.0
    lr_mean = float(np.mean(lr_asyms)); lr_std = float(np.std(lr_asyms, ddof=1)) if len(lr_asyms) > 1 else 0.0
    tb_mean = float(np.mean(tb_asyms)); tb_std = float(np.std(tb_asyms, ddof=1)) if len(tb_asyms) > 1 else 0.0

    thresholds = {
        "ce_diff_ucl":   ce_mean + 3 * ce_std if not insufficient else float("inf"),
        "ce_diff_lcl":   ce_mean - 3 * ce_std if not insufficient else float("-inf"),
        "lr_asym_3sigma": 3 * lr_std if not insufficient else float("inf"),
        "tb_asym_3sigma": 3 * tb_std if not insufficient else float("inf"),
    }

    # 전체 Wafer 패턴 비율 집계
    ptype_keys = ["CENTER_HIGH", "CENTER_LOW", "LR_ASYMMETRY", "TB_ASYMMETRY", "NORMAL"]
    pattern_counts = {k: 0 for k in ptype_keys}
    valid_count = 0

    if not insufficient:
        for m in measurements:
            if None in (m.value_center, m.value_top, m.value_bottom, m.value_left, m.value_right):
                continue
            valid_count += 1
            m_ce = float(m.value_center - np.mean([m.value_top, m.value_bottom, m.value_left, m.value_right]))
            m_lr = float(m.value_left  - m.value_right)  if (m.value_left  is not None and m.value_right  is not None) else 0.0
            m_tb = float(m.value_top   - m.value_bottom) if (m.value_top   is not None and m.value_bottom is not None) else 0.0
            for p in detect_spatial_pattern(m_ce, m_lr, m_tb, thresholds):
                if p["type"] in pattern_counts:
                    pattern_counts[p["type"]] += 1

    pattern_rates = {
        k: {
            "count": pattern_counts[k],
            "rate":  round(pattern_counts[k] / valid_count * 100, 1) if valid_count > 0 else 0.0,
        }
        for k in ptype_keys
    } if not insufficient else None

    pattern_analysis = {
        "insufficient_data": insufficient,
        "total_wafers":      valid_count if not insufficient else len(measurements),
        "pattern_rates":     pattern_rates,
        "ce_diff":           {"mean": round(ce_mean, 4), "std": round(ce_std, 4)},
        "lr_asymmetry":      {"mean": round(lr_mean, 4), "std": round(lr_std, 4)},
        "tb_asymmetry":      {"mean": round(tb_mean, 4), "std": round(tb_std, 4)},
    }

    return _convert_numpy_types({
        "target_id":        target_id,
        "summary":          summary,
        "site_statistics":  site_statistics,
        "range_statistics": range_statistics,
        "pattern_analysis": pattern_analysis,
    })


def get_site_trend(
    db: Session,
    target_id: int,
    days: int = 30,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None,
    etch_equipment_id: Optional[int] = None,
) -> Dict[str, Any]:
    """위치별 편차 추이 데이터 반환 (명세서 3.2)"""

    measurements = _build_measurement_query(
        db, target_id, days, start_date, end_date,
        coating_equipment_id, exposure_equipment_id,
        development_equipment_id, etch_equipment_id,
    ).all()

    if not measurements:
        return {"target_id": target_id, "trend_data": [], "control_limits": None}

    # 장비 이름 조회 (일괄 쿼리)
    eq_ids = {
        eid for m in measurements
        for eid in [m.coating_equipment_id, m.exposure_equipment_id,
                    m.development_equipment_id, m.etch_equipment_id]
        if eid
    }
    eq_map: Dict[int, str] = {}
    if eq_ids:
        equipments = db.query(models.Equipment).filter(models.Equipment.id.in_(eq_ids)).all()
        eq_map = {e.id: e.name for e in equipments}

    insufficient = len(measurements) < 30

    # 위치별 관리한계 산출
    control_limits: Dict[str, Any] = {}
    for cfg in _SITE_CONFIG:
        col = cfg["column"]
        devs = [getattr(m, col) - m.avg_value for m in measurements
                if getattr(m, col) is not None and m.avg_value is not None]
        dev_mean = float(np.mean(devs)) if devs else 0.0
        dev_std  = float(np.std(devs, ddof=1)) if len(devs) > 1 else 0.0
        control_limits[cfg["site"]] = {
            "ucl":  None if insufficient else round(dev_mean + 3 * dev_std, 4),
            "lcl":  None if insufficient else round(dev_mean - 3 * dev_std, 4),
            "mean": round(dev_mean, 4),
        }

    range_vals = [m.range_value for m in measurements if m.range_value is not None]
    range_mean = float(np.mean(range_vals)) if range_vals else 0.0
    range_std  = float(np.std(range_vals, ddof=1)) if len(range_vals) > 1 else 0.0
    control_limits["range"] = {
        "ucl":  None if insufficient else round(range_mean + 3 * range_std, 4),
        "mean": round(range_mean, 4),
    }

    # 패턴 판정용 임계값 (전체 데이터 기준)
    ce_diffs_all = [
        m.value_center - float(np.mean([m.value_top, m.value_bottom, m.value_left, m.value_right]))
        for m in measurements
        if None not in (m.value_center, m.value_top, m.value_bottom, m.value_left, m.value_right)
    ]
    lr_asyms_all = [m.value_left - m.value_right for m in measurements
                    if m.value_left is not None and m.value_right is not None]
    tb_asyms_all = [m.value_top  - m.value_bottom for m in measurements
                    if m.value_top  is not None and m.value_bottom is not None]
    ce_mean_all = float(np.mean(ce_diffs_all)) if ce_diffs_all else 0.0
    ce_std_all  = float(np.std(ce_diffs_all, ddof=1)) if len(ce_diffs_all) > 1 else 0.0
    lr_std_all  = float(np.std(lr_asyms_all, ddof=1)) if len(lr_asyms_all) > 1 else 0.0
    tb_std_all  = float(np.std(tb_asyms_all, ddof=1)) if len(tb_asyms_all) > 1 else 0.0
    thresholds = {
        "ce_diff_ucl":    ce_mean_all + 3 * ce_std_all if not insufficient else float("inf"),
        "ce_diff_lcl":    ce_mean_all - 3 * ce_std_all if not insufficient else float("-inf"),
        "lr_asym_3sigma": 3 * lr_std_all if not insufficient else float("inf"),
        "tb_asym_3sigma": 3 * tb_std_all if not insufficient else float("inf"),
    }

    # 측정별 추이 데이터 생성
    trend_data = []
    for m in measurements:
        edge_vals = [v for v in [m.value_top, m.value_bottom, m.value_left, m.value_right] if v is not None]
        edge_mean = float(np.mean(edge_vals)) if edge_vals else None
        ce_diff   = round(float(m.value_center - edge_mean), 4) if (m.value_center is not None and edge_mean is not None) else None
        lr_asym   = round(float(m.value_left - m.value_right), 4) if (m.value_left is not None and m.value_right is not None) else None
        tb_asym   = round(float(m.value_top  - m.value_bottom), 4) if (m.value_top  is not None and m.value_bottom is not None) else None

        alerts = []
        if not insufficient and ce_diff is not None and lr_asym is not None and tb_asym is not None:
            raw = detect_spatial_pattern(ce_diff, lr_asym, tb_asym, thresholds)
            alerts = [a for a in raw if a["type"] != "NORMAL"]

        avg_v   = m.avg_value   if m.avg_value   is not None else None
        range_v = m.range_value if m.range_value is not None else None

        def _dev(val):
            return round(val - avg_v, 4) if (val is not None and avg_v is not None) else None

        trend_data.append({
            "measurement_id": m.id,
            "datetime":   m.created_at.isoformat(),
            "lot_no":     m.lot_no,
            "wafer_no":   m.wafer_no,
            "equipments": {
                "coating":     eq_map.get(m.coating_equipment_id),
                "exposure":    eq_map.get(m.exposure_equipment_id),
                "development": eq_map.get(m.development_equipment_id),
                "etch":        eq_map.get(m.etch_equipment_id),
            },
            "values": {"T": m.value_top, "C": m.value_center, "B": m.value_bottom, "L": m.value_left, "R": m.value_right},
            "avg_value":   round(avg_v, 4) if avg_v is not None else None,
            "range_value": round(range_v, 4) if range_v is not None else None,
            "deviations": {
                "T": _dev(m.value_top),
                "C": _dev(m.value_center),
                "B": _dev(m.value_bottom),
                "L": _dev(m.value_left),
                "R": _dev(m.value_right),
            },
            "ce_diff": ce_diff,
            "lr_asym": lr_asym,
            "tb_asym": tb_asym,
            "alerts":  alerts,
        })

    return _convert_numpy_types({
        "target_id":      target_id,
        "trend_data":     trend_data,
        "control_limits": control_limits,
    })