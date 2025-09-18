import sys
import os
import random
from datetime import datetime, timedelta

# 상위 디렉토리를 sys.path에 추가하여 백엔드 모듈을 임포트할 수 있게 함
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from backend.database import models, database
from backend.schemas import measurement

# 랜덤 측정값 생성 함수
def generate_random_measurement(target_id, equipment_id, base_value=50.0, std_dev=1.0):
    # 기본값 주변에서 랜덤 값 생성
    value_top = round(random.normalvariate(base_value, std_dev), 3)
    value_center = round(random.normalvariate(base_value, std_dev), 3)
    value_bottom = round(random.normalvariate(base_value, std_dev), 3)
    value_left = round(random.normalvariate(base_value, std_dev), 3)
    value_right = round(random.normalvariate(base_value, std_dev), 3)
    
    device = f"FT-{random.randint(1000, 9999)}RP"
    lot_no = f"LOT{random.randint(10000, 99999)}"
    wafer_no = f"{random.randint(1, 50):02d}"
    exposure_time = random.randint(1000, 3000)
    
    # 측정 데이터 생성
    measurement_data = measurement.MeasurementCreate(
        target_id=target_id,
        equipment_id=equipment_id,
        device=device,
        lot_no=lot_no,
        wafer_no=wafer_no,
        exposure_time=exposure_time,
        value_top=value_top,
        value_center=value_center,
        value_bottom=value_bottom,
        value_left=value_left,
        value_right=value_right,
        author="Sample Generator"
    )
    
    return measurement_data

# 트렌드 패턴 생성 함수 (Nelson Rule 테스트용)
def generate_trend_pattern(target_id, equipment_id, start_value=50.0, increment=0.2, count=10):
    measurements = []
    current_value = start_value
    
    for _ in range(count):
        # 증가 추세 생성
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id,
            base_value=current_value,
            std_dev=0.1  # 낮은 표준편차로 추세를 더 명확하게 함
        )
        measurements.append(measurement_data)
        current_value += increment
    
    return measurements

# 이상점 패턴 생성 함수 (Nelson Rule 1 테스트용)
def generate_outlier_pattern(target_id, equipment_id, base_value=50.0, std_dev=1.0, outlier_shift=5.0):
    measurements = []
    
    # 정상 데이터 생성
    for _ in range(5):
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id,
            base_value=base_value,
            std_dev=std_dev
        )
        measurements.append(measurement_data)
    
    # 이상점 생성
    outlier = generate_random_measurement(
        target_id=target_id,
        equipment_id=equipment_id,
        base_value=base_value + outlier_shift,  # 큰 편차를 가진 이상점
        std_dev=std_dev
    )
    measurements.append(outlier)
    
    # 추가 정상 데이터
    for _ in range(5):
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id,
            base_value=base_value,
            std_dev=std_dev
        )
        measurements.append(measurement_data)
    
    return measurements

# 단계적 이동 패턴 생성 함수 (Nelson Rule 2 테스트용)
def generate_shift_pattern(target_id, equipment_id, base_value=50.0, shift=2.0, count=20):
    measurements = []
    
    # 이동 전 데이터
    for _ in range(count // 2):
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id,
            base_value=base_value,
            std_dev=0.5
        )
        measurements.append(measurement_data)
    
    # 이동 후 데이터
    for _ in range(count // 2):
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id,
            base_value=base_value + shift,
            std_dev=0.5
        )
        measurements.append(measurement_data)
    
    return measurements

# 샘플 데이터 생성 및 저장
def generate_sample_data(db: Session, target_id: int, equipment_id: int = 1, days: int = 30):
    # 기존 샘플 데이터 삭제 (선택 사항)
    db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.author == "Sample Generator"
    ).delete(synchronize_session=False)
    db.commit()
    
    # 랜덤 데이터 생성
    random_count = 20
    random_measurements = []
    for i in range(random_count):
        # 최근 days일 동안의 랜덤 날짜 생성
        created_at = datetime.now() - timedelta(days=random.uniform(0, days))
        
        # 측정 데이터 생성
        measurement_data = generate_random_measurement(
            target_id=target_id,
            equipment_id=equipment_id
        )
        
        # 데이터베이스 객체 생성
        values = [
            measurement_data.value_top,
            measurement_data.value_center,
            measurement_data.value_bottom,
            measurement_data.value_left,
            measurement_data.value_right
        ]
        avg_value = sum(values) / len(values)
        
        db_measurement = models.Measurement(
            target_id=measurement_data.target_id,
            equipment_id=measurement_data.equipment_id,
            device=measurement_data.device,
            lot_no=measurement_data.lot_no,
            wafer_no=measurement_data.wafer_no,
            exposure_time=measurement_data.exposure_time,
            value_top=measurement_data.value_top,
            value_center=measurement_data.value_center,
            value_bottom=measurement_data.value_bottom,
            value_left=measurement_data.value_left,
            value_right=measurement_data.value_right,
            avg_value=round(avg_value, 3),
            min_value=round(min(values), 3),
            max_value=round(max(values), 3),
            range_value=round(max(values) - min(values), 3),
            std_dev=round(
                (sum((x - avg_value) ** 2 for x in values) / len(values)) ** 0.5, 3
            ),
            author="Sample Generator",
            created_at=created_at
        )
        random_measurements.append(db_measurement)
    
    # 추세 패턴 생성 (최근 10일 동안)
    trend_measurements = generate_trend_pattern(target_id, equipment_id)
    trend_db_measurements = []
    for i, m_data in enumerate(trend_measurements):
        days_ago = 10 - (i * 10 / len(trend_measurements))
        created_at = datetime.now() - timedelta(days=days_ago)
        
        values = [
            m_data.value_top,
            m_data.value_center,
            m_data.value_bottom,
            m_data.value_left,
            m_data.value_right
        ]
        avg_value = sum(values) / len(values)
        
        db_measurement = models.Measurement(
            target_id=m_data.target_id,
            equipment_id=m_data.equipment_id,
            device=m_data.device,
            lot_no=m_data.lot_no,
            wafer_no=m_data.wafer_no,
            exposure_time=m_data.exposure_time,
            value_top=m_data.value_top,
            value_center=m_data.value_center,
            value_bottom=m_data.value_bottom,
            value_left=m_data.value_left,
            value_right=m_data.value_right,
            avg_value=round(avg_value, 3),
            min_value=round(min(values), 3),
            max_value=round(max(values), 3),
            range_value=round(max(values) - min(values), 3),
            std_dev=round(
                (sum((x - avg_value) ** 2 for x in values) / len(values)) ** 0.5, 3
            ),
            author="Sample Generator",
            created_at=created_at
        )
        trend_db_measurements.append(db_measurement)
    
    # 이상점 패턴 생성 (최근 5일 동안)
    outlier_measurements = generate_outlier_pattern(target_id, equipment_id)
    outlier_db_measurements = []
    for i, m_data in enumerate(outlier_measurements):
        days_ago = 5 - (i * 5 / len(outlier_measurements))
        created_at = datetime.now() - timedelta(days=days_ago)
        
        values = [
            m_data.value_top,
            m_data.value_center,
            m_data.value_bottom,
            m_data.value_left,
            m_data.value_right
        ]
        avg_value = sum(values) / len(values)
        
        db_measurement = models.Measurement(
            target_id=m_data.target_id,
            equipment_id=m_data.equipment_id,
            device=m_data.device,
            lot_no=m_data.lot_no,
            wafer_no=m_data.wafer_no,
            exposure_time=m_data.exposure_time,
            value_top=m_data.value_top,
            value_center=m_data.value_center,
            value_bottom=m_data.value_bottom,
            value_left=m_data.value_left,
            value_right=m_data.value_right,
            avg_value=round(avg_value, 3),
            min_value=round(min(values), 3),
            max_value=round(max(values), 3),
            range_value=round(max(values) - min(values), 3),
            std_dev=round(
                (sum((x - avg_value) ** 2 for x in values) / len(values)) ** 0.5, 3
            ),
            author="Sample Generator",
            created_at=created_at
        )
        outlier_db_measurements.append(db_measurement)
    
    # 모든 데이터 저장
    db.add_all(random_measurements)
    db.add_all(trend_db_measurements)
    db.add_all(outlier_db_measurements)
    db.commit()
    
    print(f"생성된 샘플 데이터: {len(random_measurements) + len(trend_db_measurements) + len(outlier_db_measurements)}개")
    return len(random_measurements) + len(trend_db_measurements) + len(outlier_db_measurements)

if __name__ == "__main__":
    # 명령줄 인자로 target_id와 equipment_id를 받을 수 있음
    target_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    equipment_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    days = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    
    db = database.SessionLocal()
    try:
        count = generate_sample_data(db, target_id, equipment_id, days)
        print(f"타겟 ID {target_id}에 대해 {count}개의 샘플 측정 데이터가 생성되었습니다.")
    finally:
        db.close()