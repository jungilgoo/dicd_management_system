"""
PR Thickness 측정 데이터 관리를 위한 서비스 로직
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..database import crud, models
from ..schemas import pr_thickness


class PRThicknessService:
    """PR Thickness 관련 비즈니스 로직을 처리하는 서비스 클래스"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def validate_measurement_data(self, measurement_data: pr_thickness.PRThicknessMeasurementCreate) -> bool:
        """측정 데이터 유효성 검증"""
        # 장비 존재 확인
        equipment = crud.get_pr_thickness_equipment(self.db, measurement_data.equipment_id)
        if not equipment:
            raise ValueError(f"장비 ID {measurement_data.equipment_id}를 찾을 수 없습니다")
        
        # 최소 하나의 측정값 확인
        measurement_values = [
            measurement_data.value_top,
            measurement_data.value_center,
            measurement_data.value_bottom,
            measurement_data.value_left,
            measurement_data.value_right
        ]
        
        if not any(value is not None for value in measurement_values):
            raise ValueError("최소 하나의 측정값은 입력되어야 합니다")
        
        return True
    
    def calculate_measurement_stats(self, values: List[Optional[int]]) -> Dict[str, Optional[int]]:
        """측정값들로부터 통계값 계산"""
        # None이 아닌 값들만 필터링
        valid_values = [v for v in values if v is not None]
        
        if not valid_values:
            return {"avg_value": None, "range_value": None, "min_value": None, "max_value": None}
        
        min_value = min(valid_values)
        max_value = max(valid_values)
        avg_value = int(sum(valid_values) / len(valid_values))
        range_value = max_value - min_value if len(valid_values) > 1 else 0
        
        return {
            "avg_value": avg_value,
            "range_value": range_value,
            "min_value": min_value,
            "max_value": max_value
        }
    
    def validate_equipment_settings(self, equipment_data: pr_thickness.PRThicknessEquipmentCreate) -> bool:
        """장비 설정 유효성 검증"""
        # SPEC 범위 검증
        if equipment_data.spec_min >= equipment_data.spec_max:
            raise ValueError(f"SPEC 최소값({equipment_data.spec_min})은 최대값({equipment_data.spec_max})보다 작아야 합니다")
        
        # 목표 두께가 SPEC 범위 내에 있는지 확인
        if not (equipment_data.spec_min <= equipment_data.target_thickness <= equipment_data.spec_max):
            raise ValueError(
                f"목표 두께({equipment_data.target_thickness})는 SPEC 범위({equipment_data.spec_min}-{equipment_data.spec_max}) 내에 있어야 합니다"
            )
        
        return True
    
    def generate_quality_report(
        self, 
        equipment_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """품질 보고서 생성"""
        # 기본 기간 설정 (최근 30일)
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        measurements = crud.get_pr_thickness_chart_data(
            self.db,
            equipment_id=equipment_id,
            start_date=start_date,
            end_date=end_date
        )
        
        if not measurements:
            return {
                "period": f"{start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}",
                "total_measurements": 0,
                "equipment_summary": {},
                "quality_metrics": {}
            }
        
        # 장비별 통계
        equipment_stats = {}
        all_measurements = []
        
        for measurement in measurements:
            equipment_name = measurement.equipment.name
            if equipment_name not in equipment_stats:
                equipment_stats[equipment_name] = {
                    "count": 0,
                    "avg_values": [],
                    "range_values": [],
                    "target": measurement.equipment.target_thickness,
                    "spec_min": measurement.equipment.spec_min,
                    "spec_max": measurement.equipment.spec_max,
                    "out_of_spec_count": 0
                }
            
            stats = equipment_stats[equipment_name]
            stats["count"] += 1
            
            if measurement.avg_value is not None:
                stats["avg_values"].append(measurement.avg_value)
                all_measurements.append(measurement.avg_value)
                
                # SPEC 위반 확인
                if not (stats["spec_min"] <= measurement.avg_value <= stats["spec_max"]):
                    stats["out_of_spec_count"] += 1
            
            if measurement.range_value is not None:
                stats["range_values"].append(measurement.range_value)
        
        # 장비별 요약 계산
        equipment_summary = {}
        for equipment_name, stats in equipment_stats.items():
            avg_values = stats["avg_values"]
            range_values = stats["range_values"]
            
            equipment_summary[equipment_name] = {
                "총 측정 횟수": stats["count"],
                "평균 두께": round(sum(avg_values) / len(avg_values)) if avg_values else 0,
                "평균 범위": round(sum(range_values) / len(range_values)) if range_values else 0,
                "SPEC 위반 횟수": stats["out_of_spec_count"],
                "SPEC 준수율": round((stats["count"] - stats["out_of_spec_count"]) / stats["count"] * 100, 1) if stats["count"] > 0 else 0,
                "목표값": stats["target"],
                "SPEC 범위": f"{stats['spec_min']} ~ {stats['spec_max']}"
            }
        
        # 전체 품질 메트릭
        quality_metrics = {}
        if all_measurements:
            quality_metrics = {
                "전체 평균 두께": round(sum(all_measurements) / len(all_measurements)),
                "전체 표준편차": round(self._calculate_std_dev(all_measurements)),
                "측정값 분포": self._calculate_distribution(all_measurements),
                "품질 트렌드": self._analyze_quality_trend(measurements)
            }
        
        return {
            "period": f"{start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}",
            "total_measurements": len(measurements),
            "equipment_summary": equipment_summary,
            "quality_metrics": quality_metrics
        }
    
    def _calculate_std_dev(self, values: List[int]) -> float:
        """표준편차 계산"""
        if len(values) < 2:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5
    
    def _calculate_distribution(self, values: List[int]) -> Dict[str, int]:
        """측정값 분포 계산"""
        if not values:
            return {}
        
        min_val = min(values)
        max_val = max(values)
        range_val = max_val - min_val
        
        # 5개 구간으로 나누어 분포 계산
        if range_val == 0:
            return {"모든값동일": len(values)}
        
        bin_size = range_val / 5
        distribution = {}
        
        for i in range(5):
            bin_start = min_val + i * bin_size
            bin_end = bin_start + bin_size
            bin_name = f"{int(bin_start)}-{int(bin_end)}"
            
            count = sum(1 for v in values if bin_start <= v < bin_end)
            if i == 4:  # 마지막 구간은 끝값 포함
                count = sum(1 for v in values if bin_start <= v <= bin_end)
            
            if count > 0:
                distribution[bin_name] = count
        
        return distribution
    
    def _analyze_quality_trend(self, measurements: List[models.PRThicknessMeasurement]) -> str:
        """품질 트렌드 분석"""
        if len(measurements) < 5:
            return "데이터 부족"
        
        # 최근 5개와 이전 5개 측정값 비교
        recent_measurements = measurements[-5:]
        previous_measurements = measurements[-10:-5] if len(measurements) >= 10 else measurements[:-5]
        
        recent_avg = sum(m.avg_value for m in recent_measurements if m.avg_value) / len([m for m in recent_measurements if m.avg_value])
        previous_avg = sum(m.avg_value for m in previous_measurements if m.avg_value) / len([m for m in previous_measurements if m.avg_value])
        
        if recent_avg > previous_avg * 1.02:  # 2% 이상 증가
            return "상승 추세"
        elif recent_avg < previous_avg * 0.98:  # 2% 이상 감소
            return "하락 추세"
        else:
            return "안정적"
    
    def check_alert_conditions(self, measurement: models.PRThicknessMeasurement) -> List[str]:
        """알림 조건 확인"""
        alerts = []
        
        if not measurement.avg_value or not measurement.equipment:
            return alerts
        
        equipment = measurement.equipment
        avg_value = measurement.avg_value
        
        # SPEC 위반 확인
        if avg_value < equipment.spec_min:
            alerts.append(f"SPEC 하한 위반: {avg_value} < {equipment.spec_min}")
        elif avg_value > equipment.spec_max:
            alerts.append(f"SPEC 상한 위반: {avg_value} > {equipment.spec_max}")
        
        # 목표값 편차 확인 (±5% 초과)
        target = equipment.target_thickness
        deviation_percent = abs(avg_value - target) / target * 100
        if deviation_percent > 5:
            alerts.append(f"목표값 편차 큼: {deviation_percent:.1f}% (±5% 초과)")
        
        # 범위 확인 (목표값의 10% 초과)
        if measurement.range_value and measurement.range_value > target * 0.1:
            alerts.append(f"측정값 범위 큼: {measurement.range_value} (목표값의 10% 초과)")
        
        return alerts
    
    def get_equipment_utilization(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """장비 가동률 분석"""
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # 모든 장비 조회
        equipments = crud.get_pr_thickness_equipments(self.db)
        
        utilization_data = {}
        for equipment in equipments:
            measurements, total = crud.get_pr_thickness_measurements(
                self.db,
                equipment_id=equipment.id,
                start_date=start_date,
                end_date=end_date,
                page=1,
                limit=1000  # 충분히 큰 수
            )
            
            # 날짜별 측정 여부 확인
            period_days = (end_date - start_date).days + 1
            measurement_dates = set()
            
            for measurement in measurements:
                measurement_dates.add(measurement.created_at.date())
            
            utilization_rate = len(measurement_dates) / period_days * 100 if period_days > 0 else 0
            
            utilization_data[equipment.name] = {
                "장비번호": equipment.equipment_number,
                "총측정횟수": total,
                "측정일수": len(measurement_dates),
                "전체일수": period_days,
                "가동률": round(utilization_rate, 1)
            }
        
        return {
            "분석기간": f"{start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}",
            "장비별가동률": utilization_data,
            "평균가동률": round(sum(data["가동률"] for data in utilization_data.values()) / len(utilization_data), 1) if utilization_data else 0
        }