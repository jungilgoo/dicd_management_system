"""
Particle 측정 데이터 관리를 위한 서비스 로직
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..database import crud, models
from ..schemas import particle


class ParticleService:
    """Particle 관련 비즈니스 로직을 처리하는 서비스 클래스"""

    def __init__(self, db: Session):
        self.db = db

    def validate_measurement_data(self, measurement_data: particle.ParticleMeasurementCreate) -> bool:
        """측정 데이터 유효성 검증"""
        equipment = crud.get_particle_equipment_by_number(self.db, measurement_data.equipment_id)
        if not equipment:
            raise ValueError(f"장비 번호 {measurement_data.equipment_id}를 찾을 수 없습니다")

        has_data = any([
            measurement_data.before_y, measurement_data.before_o, measurement_data.before_b,
            measurement_data.after_y, measurement_data.after_o, measurement_data.after_b
        ])
        if not has_data:
            raise ValueError("코팅 전/후 측정값을 최소 하나 이상 입력해야 합니다")

        return True

    def validate_equipment_settings(self, equipment_data: particle.ParticleEquipmentCreate) -> bool:
        """장비 설정 유효성 검증"""
        if equipment_data.spec_max <= 0:
            raise ValueError(f"SPEC 최대값({equipment_data.spec_max})은 0보다 커야 합니다")

        return True

    def generate_quality_report(
        self,
        equipment_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """품질 보고서 생성"""
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        measurements = crud.get_particle_chart_data(
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

        equipment_stats = {}
        all_values = []

        for measurement in measurements:
            equipment_name = measurement.equipment.name
            if equipment_name not in equipment_stats:
                equipment_stats[equipment_name] = {
                    "count": 0,
                    "values": [],
                    "spec_max": measurement.equipment.spec_max,
                    "out_of_spec_count": 0
                }

            stats = equipment_stats[equipment_name]
            stats["count"] += 1

            if measurement.value is not None:
                stats["values"].append(measurement.value)
                all_values.append(measurement.value)

                if measurement.value > stats["spec_max"]:
                    stats["out_of_spec_count"] += 1

        equipment_summary = {}
        for equipment_name, stats in equipment_stats.items():
            values = stats["values"]

            equipment_summary[equipment_name] = {
                "총 측정 횟수": stats["count"],
                "평균 파티클 개수": round(sum(values) / len(values)) if values else 0,
                "SPEC 위반 횟수": stats["out_of_spec_count"],
                "SPEC 준수율": round((stats["count"] - stats["out_of_spec_count"]) / stats["count"] * 100, 1) if stats["count"] > 0 else 0,
                "SPEC 최대값": stats["spec_max"]
            }

        quality_metrics = {}
        if all_values:
            quality_metrics = {
                "전체 평균 파티클 개수": round(sum(all_values) / len(all_values)),
                "전체 표준편차": round(self._calculate_std_dev(all_values)),
                "측정값 분포": self._calculate_distribution(all_values),
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

        if range_val == 0:
            return {"모든값동일": len(values)}

        bin_size = range_val / 5
        distribution = {}

        for i in range(5):
            bin_start = min_val + i * bin_size
            bin_end = bin_start + bin_size
            bin_name = f"{int(bin_start)}-{int(bin_end)}"

            count = sum(1 for v in values if bin_start <= v < bin_end)
            if i == 4:
                count = sum(1 for v in values if bin_start <= v <= bin_end)

            if count > 0:
                distribution[bin_name] = count

        return distribution

    def _analyze_quality_trend(self, measurements: List[models.ParticleMeasurement]) -> str:
        """품질 트렌드 분석"""
        valid = [m for m in measurements if m.value is not None]
        if len(valid) < 5:
            return "데이터 부족"

        recent = valid[-5:]
        previous = valid[-10:-5] if len(valid) >= 10 else valid[:-5]

        if not previous:
            return "데이터 부족"

        recent_avg = sum(m.value for m in recent) / len(recent)
        previous_avg = sum(m.value for m in previous) / len(previous)

        if recent_avg > previous_avg * 1.02:
            return "상승 추세"
        elif recent_avg < previous_avg * 0.98:
            return "하락 추세"
        else:
            return "안정적"

    def check_alert_conditions(self, measurement: models.ParticleMeasurement) -> List[str]:
        """알림 조건 확인"""
        alerts = []

        if measurement.value is None or not measurement.equipment:
            return alerts

        equipment = measurement.equipment
        value = measurement.value

        if value > equipment.spec_max:
            alerts.append(f"SPEC 초과: {value} > {equipment.spec_max}")

        return alerts

    def get_equipment_utilization(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """장비 가동률 분석"""
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        equipments = crud.get_particle_equipments(self.db)

        utilization_data = {}
        for equipment in equipments:
            measurements, total = crud.get_particle_measurements(
                self.db,
                equipment_id=equipment.id,
                start_date=start_date,
                end_date=end_date,
                page=1,
                limit=1000
            )

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
