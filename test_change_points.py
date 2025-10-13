#!/usr/bin/env python3
"""
테스트용 변경점 데이터 생성 스크립트
"""
import sys
import os
from datetime import datetime, timedelta

# 프로젝트 경로를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database.database import SessionLocal
from backend.database import models

def create_test_change_points():
    """테스트용 변경점 데이터 생성"""
    db = SessionLocal()
    
    try:
        # 기존 변경점 확인
        existing_count = db.query(models.ChangePoint).count()
        print(f"기존 변경점 수: {existing_count}")
        
        # 첫 번째 타겟 찾기
        first_target = db.query(models.Target).first()
        if not first_target:
            print("타겟이 없습니다. 먼저 기본 데이터를 생성하세요.")
            return
            
        print(f"테스트 타겟: {first_target.name} (ID: {first_target.id})")
        print(f"제품군: {first_target.process.product_group.name}")
        print(f"공정: {first_target.process.name}")
        
        # 최근 측정 데이터 확인
        recent_measurements = db.query(models.Measurement).filter(
            models.Measurement.target_id == first_target.id
        ).order_by(models.Measurement.created_at.desc()).limit(5).all()
        
        if not recent_measurements:
            print("측정 데이터가 없습니다.")
            return
            
        print(f"최근 측정 데이터 수: {len(recent_measurements)}")
        for m in recent_measurements:
            print(f"  - {m.created_at.date()}: {m.avg_value}")
        
        # 실제 측정 데이터가 있는 날짜를 기반으로 테스트 변경점 추가
        if recent_measurements:
            # 가장 최근 측정 날짜에서 변경점 생성
            latest_measurement_date = recent_measurements[0].created_at.date()
            test_dates = [latest_measurement_date]
            
            # 추가로 다른 측정 날짜들도 사용
            if len(recent_measurements) > 1:
                test_dates.append(recent_measurements[1].created_at.date())
            if len(recent_measurements) > 2:
                test_dates.append(recent_measurements[2].created_at.date())
        else:
            # 기본 테스트 날짜들
            test_dates = [
                datetime.now() - timedelta(days=15),
                datetime.now() - timedelta(days=7),
                datetime.now() - timedelta(days=3),
            ]
        
        for i, change_date in enumerate(test_dates):
            # 기존 변경점이 있는지 확인
            if isinstance(change_date, datetime):
                check_date = change_date.date()
            else:
                check_date = change_date
                
            existing = db.query(models.ChangePoint).filter(
                models.ChangePoint.target_id == first_target.id,
                models.ChangePoint.change_date == check_date
            ).first()
            
            if not existing:
                change_point = models.ChangePoint(
                    product_group_id=first_target.process.product_group_id,
                    process_id=first_target.process_id,
                    target_id=first_target.id,
                    change_date=change_date,
                    description=f"테스트 변경점 {i+1}: 공정 파라미터 변경"
                )
                db.add(change_point)
                print(f"변경점 추가: {check_date}")
            else:
                print(f"변경점 이미 존재: {check_date}")
        
        db.commit()
        
        # 결과 확인
        total_change_points = db.query(models.ChangePoint).count()
        target_change_points = db.query(models.ChangePoint).filter(
            models.ChangePoint.target_id == first_target.id
        ).count()
        
        print(f"전체 변경점 수: {total_change_points}")
        print(f"테스트 타겟 변경점 수: {target_change_points}")
        
    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_change_points()