from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy.orm import Session
from ..database import models
import math

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

    # NumPy 타입을 Python 내장 타입으로 변환
    result = convert_numpy_types(result)

    return result